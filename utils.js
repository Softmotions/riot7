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
                onSuccess.attachTo = $photoRoot[0];
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

function maskedInput(domEl, opts) {

    // Based on https://github.com/sanniassin/react-input-mask
    var $input = $(domEl),
            lastCaretPos = null,
            pasteSelection = null,
            permanents = [],
            state = {},
            mask = opts.mask || '',
            maskChar = null,
            charsRules = {
                '9': '[0-9]',
                'a': '[A-Za-z]',
                '*': '[A-Za-z0-9]'
            },
            isAndroidBrowser = true;

    function setValue(v) {
        $input.value = state.value = v;
    }

    function isAllowedChar(char, pos, allowMaskChar = false) {
        if (isPermanentChar(pos)) {
            return mask[pos] === char;
        }
        var charRule = charsRules[mask[pos]];
        return (new RegExp(charRule)).test(char || '') || (allowMaskChar && char === maskChar);
    }

    function isPermanentChar(pos) {
        return permanents.indexOf(pos) !== -1;
    }

    function getPrefix() {
        var prefix = '';
        for (var i = 0; i < mask.length && isPermanentChar(i); ++i) {
            prefix += mask[i];
        }
        return prefix;
    }

    function getFilledLength(value = state.value) {
        if (!maskChar) {
            return value.length;
        }
        var i;
        for (i = value.length - 1; i >= 0; --i) {
            var char = value[i];
            if (!isPermanentChar(i) && isAllowedChar(char, i)) {
                break;
            }
        }
        return ++i || getPrefix().length;
    }

    function getLeftEditablePos(pos) {
        var i;
        for (i = pos; i >= 0; --i) {
            if (!isPermanentChar(i)) {
                return i;
            }
        }
        return null;
    }

    function getRightEditablePos(pos) {
        var i;
        for (i = pos; i < mask.length; ++i) {
            if (!isPermanentChar(i)) {
                return i;
            }
        }
        return null;
    }

    function isEmpty(value = state.value) {
        return !value.split('').some((char, i) => !isPermanentChar(i) && isAllowedChar(char, i));
    }

    function isFilled(value = state.value) {
        return getFilledLength(value) === mask.length;
    }

    function createFilledArray(length, val) {
        var array = new Array(length);
        for (var i = 0; i < length; i++) {
            array[i] = val;
        }
        return array;
    }

    function replaceSubstr(value, newSubstr, pos) {
        return value.slice(0, pos) + newSubstr + value.slice(pos + newSubstr.length);
    }

    function insertRawSubstr(value, substr, pos) {
        var filled = isFilled(value);
        var prefixLen = getPrefix().length;
        substr = substr.split('');

        if (!maskChar && pos > value.length) {
            value += mask.slice(value.length, pos);
        }
        for (var i = pos; i < mask.length && substr.length;) {
            if (!isPermanentChar(i) || mask[i] === substr[0]) {
                var char = substr.shift();
                if (isAllowedChar(char, i, true)) {
                    if (i < value.length) {
                        if (maskChar || filled || i < prefixLen) {
                            value = replaceSubstr(value, char, i);
                        }
                        else {
                            value = formatValue(value.substr(0, i) + char + value.substr(i));
                        }
                    } else if (!maskChar) {
                        value += char;
                    }
                    ++i;
                }
            } else {
                if (!maskChar && i >= value.length) {
                    value += mask[i];
                }
                ++i;
            }
        }
        return value;
    }

    function formatValue(value) {
        if (!maskChar) {
            var prefix = getPrefix(),
                    prefixLen = prefix.length;
            value = insertRawSubstr('', value, 0);
            while (value.length > prefixLen && isPermanentChar(value.length - 1)) {
                value = value.slice(0, value.length - 1);
            }
            if (value.length < prefixLen) {
                value = prefix;
            }
            return value;
        }
        if (value) {
            return insertRawSubstr(formatValue(''), value, 0);
        }
        return value.split('')
        .concat(createFilledArray(mask.length - value.length, null))
        .map((char, pos) => {
            if (isAllowedChar(char, pos)) {
                return char;
            } else if (isPermanentChar(pos)) {
                return mask[pos];
            }
            return maskChar;
        })
        .join('');
    }

    function clearRange(value, start, len) {
        var end = start + len;
        if (!maskChar) {
            var prefixLen = getPrefix().length;
            value = value.split('')
            .filter((char, i) => i < prefixLen || i < start || i >= end)
            .join('');
            return formatValue(value);
        }
        return value.split('')
        .map((char, i) => {
            if (i < start || i >= end) {
                return char;
            }
            if (isPermanentChar(i)) {
                return mask[i];
            }
            return maskChar;
        })
        .join('');
    }

    function getRawSubstrLength(value, substr, pos) {
        substr = substr.split('');
        for (var i = pos; i < mask.length && substr.length;) {
            if (!isPermanentChar(i) || mask[i] === substr[0]) {
                var char = substr.shift();
                if (isAllowedChar(char, i, true)) {
                    ++i;
                }
            } else {
                ++i;
            }
        }
        return i - pos;
    }

    function setCaretToEnd() {
        var filledLen = getFilledLength(),
                pos = getRightEditablePos(filledLen);
        if (pos !== null) {
            setCaretPos(pos);
        }
    }

    function setSelection(start, len = 0) {
        var input = $input[0];
        if (!input) {
            return;
        }
        var end = start + len;
        if ('selectionStart' in input && 'selectionEnd' in input) {
            input.selectionStart = start;
            input.selectionEnd = end;
        } else {
            var range = input.createTextRange();
            range.collapse(true);
            range.moveStart('character', start);
            range.moveEnd('character', end - start);
            range.select();
        }
    }

    function getSelection() {
        var input = $input[0], start = 0, end = 0;
        if ('selectionStart' in input && 'selectionEnd' in input) {
            start = input.selectionStart;
            end = input.selectionEnd;
        } else {
            var range = document.selection.createRange();
            if (range.parentElement() === input) {
                start = -range.moveStart('character', -input.value.length);
                end = -range.moveEnd('character', -input.value.length);
            }
        }
        return {
            start: start,
            end: end,
            length: end - start
        };
    }

    function getCaretPos() {
        return getSelection().start;
    }

    function setCaretPos(pos) {
        var raf = window.requestAnimationFrame
                || window.webkitRequestAnimationFrame
                || window.mozRequestAnimationFrame
                || function (fn) {
                    setTimeout(fn, 0);
                };
        var setPos = setSelection.bind(this, pos, 0);
        setPos();
        raf(setPos);
        lastCaretPos = pos;
    }

    function isFocused() {
        return !!($input.length && document.activeElement === $input[0]);
    }

    function parseMask(mask) {
        if (typeof mask !== 'string') {
            return {
                mask: null,
                permanents: []
            };
        }
        var str = '',
                permanents = [],
                isPermanent = false;

        mask.split('').forEach((char) => {
            if (!isPermanent && char === '\\') {
                isPermanent = true;
            } else {
                if (isPermanent || !charsRules[char]) {
                    permanents.push(str.length);
                }
                str += char;
                isPermanent = false;
            }
        });
        return {
            mask: str,
            permanents: permanents
        };
    }

    function getStringValue(value) {
        return !value && value !== 0 ? '' : value + '';
    }

    function pasteText(value, text, selection, event) {
        var caretPos = selection.start;
        if (selection.length) {
            value = clearRange(value, caretPos, selection.length);
        }
        var textLen = getRawSubstrLength(value, text, caretPos);
        value = insertRawSubstr(value, text, caretPos);
        caretPos += textLen;
        caretPos = getRightEditablePos(caretPos) || caretPos;
        if (value !== $input[0].value) {
            if (event) {
                event.target.value = value;
            }
            setValue(value);
            if (event && typeof opts.onchange === 'function') {
                opts.onchange(event);
            }
        }
        setCaretPos(caretPos);
    }

    function onKeyDown(event) {
        var hasHandler = typeof opts.onkeydown === 'function';
        if (event.ctrlKey || event.metaKey) {
            if (hasHandler) {
                opts.onkeydown(event);
            }
            return;
        }
        var caretPos = getCaretPos(),
                value = state.value,
                key = event.key,
                preventDefault = false;
        if (key == null) {
            key = event.code;
        }
        switch (key) {
            case 'Backspace':
            case 'Delete':
                var prefixLen = getPrefix().length,
                        deleteFromRight = key === 'Delete',
                        selectionRange = getSelection();
                if (selectionRange.length) {
                    value = clearRange(value, selectionRange.start, selectionRange.length);
                }
                else if (caretPos < prefixLen || (!deleteFromRight && caretPos === prefixLen)) {
                    caretPos = prefixLen;
                }
                else {
                    var editablePos = deleteFromRight ? getRightEditablePos(
                            caretPos) : getLeftEditablePos(caretPos - 1);
                    if (editablePos !== null) {
                        value = clearRange(value, editablePos, 1);
                        caretPos = editablePos;
                    }
                }
                preventDefault = true;
                break;
            default:
                break;
        }

        if (hasHandler) {
            opts.onkeydown(event);
        }
        if (value !== state.value) {
            event.target.value = value;
            setValue(value);
            preventDefault = true;
            if (typeof opts.onchange === 'function') {
                opts.onchange(event);
            }
        }
        if (preventDefault) {
            event.preventDefault();
            setCaretPos(caretPos);
        }
    }

    function onKeyPress(event) {
        var key = event.key;
        if (key == null) {
            key = String.fromCharCode(event.charCode);
        }
        var hasHandler = typeof opts.onkeypress === 'function';
        if (key === 'Enter' || event.ctrlKey || event.metaKey) {
            if (hasHandler) {
                opts.onkeypress(event);
            }
            return;
        }
        var caretPos = getCaretPos(),
                selection = getSelection(),
                value = state.value,
                maskLen = mask.length,
                prefixLen = getPrefix().length;

        if (isPermanentChar(caretPos) && mask[caretPos] === key) {
            value = insertRawSubstr(value, key, caretPos);
            ++caretPos;
        } else {
            var editablePos = getRightEditablePos(caretPos);
            if (editablePos !== null && isAllowedChar(key, editablePos)) {
                value = clearRange(value, selection.start, selection.length);
                value = insertRawSubstr(value, key, editablePos);
                caretPos = editablePos + 1;
            }
        }

        if (value !== state.value) {
            event.target.value = value;
            setValue(value);
            if (typeof opts.onchange === 'function') {
                opts.onchange(event);
            }
        }
        event.preventDefault();
        if (caretPos < maskLen && caretPos > prefixLen) {
            caretPos = getRightEditablePos(caretPos);
        }
        setCaretPos(caretPos);
    }


    function onChange(event) {
        var target = event.target,
                value = target.value,
                oldValue = state.value,
                clearedValue;

        if (pasteSelection) {
            pasteSelection = null;
            pasteText(oldValue, value, pasteSelection, event);
            return;
        }
        var selection = getSelection(),
                caretPos = selection.end,
                maskLen = mask.length,
                valueLen = value.length,
                oldValueLen = oldValue.length,
                prefixLen = getPrefix().length;

        if (valueLen > oldValueLen) {
            var substrLen = valueLen - oldValueLen,
                    startPos = selection.end - substrLen,
                    enteredSubstr = value.substr(startPos, substrLen);
            if (startPos < maskLen && (substrLen !== 1 || enteredSubstr !== mask[startPos])) {
                caretPos = getRightEditablePos(startPos);
            } else {
                caretPos = startPos;
            }
            value = value.substr(0, startPos) + value.substr(startPos + substrLen);
            clearedValue = clearRange(value, startPos, maskLen - startPos);
            clearedValue = insertRawSubstr(clearedValue, enteredSubstr, caretPos);
            value = insertRawSubstr(oldValue, enteredSubstr, caretPos);
            if (substrLen !== 1 || caretPos >= prefixLen && caretPos < maskLen) {
                caretPos = getFilledLength(clearedValue);
            } else if (caretPos < maskLen) {
                caretPos++;
            }
        } else if (valueLen < oldValueLen) {
            var removedLen = maskLen - valueLen,
                    substr = value.substr(0, selection.end),
                    clearOnly = substr === oldValue.substr(0, selection.end);
            clearedValue = clearRange(oldValue, selection.end, removedLen);
            if (maskChar) {
                value = insertRawSubstr(clearedValue, substr, 0);
            }
            clearedValue = clearRange(clearedValue, selection.end, maskLen - selection.end);
            clearedValue = insertRawSubstr(clearedValue, substr, 0);
            if (!clearOnly) {
                caretPos = getFilledLength(clearedValue);
            } else if (caretPos < prefixLen) {
                caretPos = prefixLen;
            }
        }
        value = formatValue(value);
        // prevent android autocomplete insertion on backspace
        if (!isAndroidBrowser) {
            target.value = value;
        }
        setValue(value);
        setCaretPos(caretPos);
        if (typeof opts.onchange === 'function') {
            opts.onchange(event);
        }
    }

    function onFocus(event) {
        if (!state.value) {
            var prefix = getPrefix();
            var value = formatValue(prefix);
            event.target.value = formatValue(value);
            setValue(value);
            setCaretToEnd();
            if (typeof opts.onchange === 'function') {
                opts.onchange(event);
            }
        } else if (getFilledLength() < mask.length) {
            setCaretToEnd();
        }

        if (typeof opts.onfocus === 'function') {
            opts.onfocus(event);
        }
    }

    function onBlur(event) {
        if (!opts.alwaysShowMask && isEmpty(state.value)) {
            event.target.value = '';
            setValue('');
            if (typeof opts.onchange === 'function') {
                opts.onchange(event);
            }
        }
        if (typeof opts.onblur === 'function') {
            opts.onblur(event);
        }
    }


    function onPaste(event) {
        if (isAndroidBrowser) {
            pasteSelection = getSelection();
            event.target.value = '';
            return;
        }
        var text;
        if (window.clipboardData && window.clipboardData.getData) { // IE
            text = window.clipboardData.getData('Text');
        } else if (event.clipboardData && event.clipboardData.getData) {
            text = event.clipboardData.getData('text/plain');
        }
        if (text) {
            var value = state.value;
            var selection = getSelection();
            pasteText(value, text, selection, event);
        }
        event.preventDefault();
    }


    //Init masked field
    (function () {
        var maskSpec = parseMask(opts.mask),
                defaultValue = opts.defaultValue != null ? opts.defaultValue : null,
                value = getStringValue(opts.value != null ? opts.value : defaultValue);

        mask = maskSpec.mask;
        permanents = maskSpec.permanents;
        maskChar = 'maskChar' in opts ? opts.maskChar : '_';
        if (opts.alwaysShowMask || value) {
            value = formatValue(value);
        }
        setValue(value);
    })();

    $input.on('focus', onFocus);
    $input.on('blur', onBlur);
    $input.on('change', onChange);
    $input.on('keypress', onKeyPress);
    $input.on('keydown', onKeyDown);
    $input.on('paste', onPaste);

    return state;
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
        return str != null ? !!str.match(/^\s*$/) : true;
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

    maskedInput
};
