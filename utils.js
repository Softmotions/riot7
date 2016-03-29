var $ = require('Dom7');
var riot = require('riot');
var cssSelectorGenerator = new (require('css-selector-generator')).CssSelectorGenerator();

Promise.prototype.done = function (onFulfilled, onRejected) {
    this.then(onFulfilled, onRejected)
    .catch(function (reason) {
        setTimeout(() => {
            throw reason
        }, 0);
    });
};

Promise.prototype.finally = function (callback) {
    let p = this.constructor;
    return this.then(
            value => p.resolve(callback()).then(() => value),
            reason => p.resolve(callback()).then(() => {
                throw reason
            })
    );
};

/**
 * Tracks attached listeners for observables
 * for later removing
 */
class TrackedListeners {

    constructor() {
        this._listeners = new Map();
    }

    onEvent(obj, eventName, fn) {
        var octx = this._listeners.get(obj);
        if (octx == null) {
            octx = {};
            this._listeners.set(obj, octx);
        }
        var eventFn = octx[eventName];
        if (!eventFn) {
            eventFn = (function () {
                var ret = function (...args) {
                    ret.fns.forEach((f) => {
                        f.apply(null, args);
                    });
                };
                ret.fns = [];
                return ret;
            })();
            octx[eventName] = eventFn;
            obj.on(eventName, eventFn);
        }
        eventFn.fns.push(fn);
    }

    dispose() {
        for (let entry of this._listeners) {
            let obj = entry[0];
            let octx = entry[1];
            this._listeners.delete(obj);
            delete this._listeners[obj];
            if (!octx || typeof obj.off !== 'function') {
                return
            }
            Object.keys(octx).forEach(eventName => {
                let eventFn = octx[eventName];
                eventFn.fns = null;
                delete octx[eventName];
                obj.off(eventName, eventFn);
            });
        }
    }
}


/**
 * Simple options container.
 */
class Options {

    constructor(options) {
        Object.keys(options || {}).forEach(o => {
            if (this[o] === undefined) {
                this[o] = options[o];
            }
        });
    }

    /**
     * Get value referred by path in container object.
     * @param {String} path Object dot separated path
     * @param {Object} def Default value
     * @returns {*}
     */
    get(path, def) {
        var ind = path.indexOf('.');
        if (ind !== -1) {
            var ctx = this, key, from = 0;
            while (ind !== -1 && ctx != null) {
                key = path.substring(from, ind);
                ctx = ctx[key];
                from = ind + 1;
                if (from >= path.length - 1) {
                    break;
                }
                ind = path.indexOf('.', from);
                if (ind === -1) {
                    ind = path.length;
                } else if (ctx == null) {
                    break;
                }
            }
            return ctx === undefined ? def : ctx;
        } else {
            return this[path] === undefined ? def : this[path];
        }
    }

    getOrFail(path) {
        var def = {};
        var res = this.get(path, def);
        if (res === def) {
            throw new Error(`Missing required options parameter: '${path}'`);
        }
        return res;
    }

}

/**
 * Создание метода фотографирования с помощью камеры
 * и инициализация результата в элементе `img` помещенного в DOM элемемент `root`.
 *
 * @param {String} root Селектор рут контейнера для камеры и фото
 * @param {Object} opts cordova-plugin-camera options
 *
 * @returns {Function}
 */
function createTakePhotoFn(root, opts) {
    opts = opts || {};
    if (opts.destinationType == null) {
        opts.destinationType = (device.platform === 'browser') ?
                               Camera.DestinationType.DATA_URL :
                               Camera.DestinationType.FILE_URI;
    }
    if (opts.sourceType == null) {
        opts.sourceType = Camera.PictureSourceType.CAMERA;
    }
    if (opts.cameraDirection == null) {
        opts.cameraDirection = Camera.Direction.BACK;
    }
    if (opts.encodingType == null) {
        opts.encodingType = (device.platform === 'browser') ? Camera.EncodingType.PNG : Camera.EncodingType.JPEG;
    }
    if (typeof opts.failFn !== 'function') {
        opts.failFn = function (message) {
            console.error('Failed to get photo: ' + message);
        }
    }

    function validateForm($root) {
        var $form = $root.parents('form[data-validate]').eq(0);
        if ($form.length) {
            var v = $form.data('validator');
            if (v && (typeof v.validateForm === 'function')) {
                v.validateForm();
            }
        }
    }

    return function () {
        if (!navigator.camera) {
            opts.failFn('No camera on device');
            return;
        }
        var $photoRoot = $(root);
        var $capture = $photoRoot.find('video + button');
        if ($capture.length) {
            $capture.click();
        } else {
            $photoRoot.children().remove();
            if (device.platform === 'browser') {
                opts.attachTo = root;
            }
            function onSuccess(imageData) {
                $photoRoot.children().remove();
                var $img = $(document.createElement('img'));
                $img[0].src = imageData;
                $photoRoot.append($img);
                if (typeof opts.successFn === 'function') {
                    opts.successFn($img[0]);
                }
                validateForm($photoRoot);
            }

            function onFail() {
                opts.failFn();
                validateForm($(root));
            }

            navigator.camera.getPicture(onSuccess, onFail, opts);
        }
    }
}


module.exports = {

    normalizeTagUrl(url) {
        var query, idx = url.indexOf('?');
        if (idx > 0) {
            query = $.parseUrlQuery(url);
            url = url.substr(0, idx);
        }
        return {
            url: url,
            query: query
        };
    },

    addTag(root, tagName, opts, cc, mixins) {
        tagName = tagName.toLowerCase();
        opts = opts || {};
        cc = cc || '';
        mixins = mixins || [];
        let selector = `${root} > div.${tagName}`;
        if ($(selector).length) {
            console.warn(`Tag '${tagName}' already exists as child of '${selector}'`);
            return;
        }
        $(root).append(`<div class="${tagName} ${cc}"></div>`);
        return this.mountTag(selector, tagName, opts, mixins);
    },

    mountTag(selector, name, opts, mixins) {
        mixins = mixins || [];
        let tag = riot.mount(selector, name, opts)[0];
        if (Array.isArray(mixins) && mixins.length > 0) {
            tag.mixin.apply(tag, mixins);
            tag.trigger('mixin');
        }
        return {
            selector: selector,
            name: name,
            tag: tag
        };
    },

    generateCssSelector(el) {
        return cssSelectorGenerator.getSelector(el);
    },

    isBlank(str) {
        return str != null ? ((str.length === 0) || !!str.match(/^\s*$/)) : true;
    },

    isDataUrl(url) {
        return (url.substring(0, 'data:'.length) === 'data:');
    },

    dataUrlToBlob(url) {
        if (!this.isDataUrl(url)) {
            return null;
        }
        //data:image/png;base64,
        var i, ia, data, prefix, ctype,
                ind = url.indexOf(',');
        if (ind === -1) {
            return null;
        }
        prefix = url.substring(0, ind);
        ctype = prefix.split(':')[1].split(';')[0];
        if (prefix.indexOf('base64') !== -1) {
            data = atob(url.substring(ind + 1));
        } else {
            data = decodeURI(url.substring(ind + 1));
        }
        ia = new Uint8Array(data.length);
        for (i = 0; i < data.length; ++i) {
            ia[i] = data.charCodeAt(i);
        }
        return new Blob([ia], {type: ctype});
    },

    Options,

    TrackedListeners,

    createTakePhotoFn,

    maskedInput: require('./mskinput'),

    /**
     * Empiric conversion of by given
     * string into Date object.
     *
     * @param {String} sdate
     * @param {boolean} [time=false] If true result will be retuned as number ms since Epoch.
     * @return {Date|number}
     */
    toDate(sdate, time = false) {
        if (sdate == null || (sdate instanceof Date)) {
            return (sdate && time) ? sdate.getTime() : sdate;
        }
        if (typeof sdate === 'number') {
            let d = new Date(sdate);
            return time ? d.getTime() : d;
        }
        sdate = sdate.trim();
        if (sdate == '') {
            return null;
        }
        var dp;
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(sdate)) {
            dp = sdate.split('.');
            [dp[0], dp[1], dp[2]] = [dp[2], dp[1], dp[0]];
        } else if (/^\d{4}\-\d{2}\-\d{2}$/.test(sdate)) {
            dp = sdate.split('-');
        } else if (/^\d{2}\-\d{2}\-\d{4}$/.test(sdate)) {
            dp = sdate.split('-');
            [dp[0], dp[1], dp[2]] = [dp[2], dp[0], dp[1]];
        }
        if (dp) {
            let d = new Date(dp.join('-')); // UTC
            return time ? d.getTime() : d;
        } else {
            return null;
        }
    },

    /**
     * Empiric normalization of a phone number
     * @param phone {?String} Phone number.
     */
    toPhone(phone) {
        return phone != null ? phone.replace(/([\(\)\-\/\s])|(^\+\d)/g, '') : null;
    }
};
