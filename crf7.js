var riot = require('riot'),
        async = require('async'),
        $ = require('Dom7'),
        fm7 = require('./fm7'),
        utils = require('./utils');

/**
 * Server response messages
 */
class Messages {

    constructor(messages) {
        this.numErrors = 0;
        if (messages == null) {
            messages = [];
        }
        if (Array.isArray(messages)) {
            this.messages = [].concat(messages);
        } else if (messages.msg != null) {
            this.messages = [{
                msg: messages.msg,
                error: !!messages.error
            }];
        } else {
            throw new Error('Invalid argument specified: ' + messages);
        }
        for (var i = 0; i < messages.length; ++i) {
            if (messages[i].error) {
                this.numErrors++;
                break;
            }
        }
    }

    get length() {
        return this.messages.length;
    }

    get hasErrors() {
        return (this.numErrors > 0);
    }

    report() {
        if (this.length > 0) {
            //todo use gui?
            console.error(this.messages);
        }
    }

    toString() {
        var out = [];
        out.push('Messages{');
        this.messages.forEach((m) => {
            out.push('\t' + (m.error ? '! ' : '* ') + m.msg);
        });
        out.push('}');
        return out.join('\n');
    }
}

/**
 * Main application object.
 *
 * Events:
 *
 * `init` - application initialization started
 * `root` - root tag mounted
 *
 */
class App {

    constructor(opts, sysopts) {
        window.app = this;
        riot.observable(this);
        this.preroutes = [];
        this.opts = new utils.Options(opts);
        this.sysopts = sysopts = sysopts || {};
        if (sysopts['messagesReportConsole'] == null) {
            sysopts['messagesReportConsole'] = true;
        }
        if (sysopts['messagesReportGUI'] == null) {
            sysopts['messagesReportGUI'] = false;
        }
        this.mainView = sysopts['mainView'] || 'view-main';
        this.xhdrPrefix = sysopts['xhdrPrefix'] || 'X-App';
        this._preloaders = 0;


        $(document).on('deviceready', () => {
            this.init();
        }, false);

        $(document).on('backbutton', (e) => {
            this.onBack();
            e.preventDefault();
        }, false);

        this.one('init', () => {
            this.ready = true;
        })
    }

    onBack() {
        var me = this;
        var view = this.fm7.getCurrentView();
        if (view) {
            var i = 0;
            var modals = [
                '.modal.modal-in:not(.modal-out)',
                '.login-screen.modal-in:not(.modal-out)',
                '.picker-modal.modal-in:not(.modal-out)',
                '.popover.modal-in:not(.modal-out)'
            ];
            for (i = 0; i < modals.length && !tryCloseModal(modals[i]); ++i);
            function tryCloseModal(m) {
                var modal = $(m);
                if (modal.length && modal[0].offsetParent != null) {
                    me.fm7.closeModal(m);
                    return true;
                }
                return false;
            }

            if (i >= modals.length) {
                return view.router.back();
            } else {
                return true;
            }
        }
        return false;
    }


    checks() {
        if (!window.device) {
            throw new Error('Seems to be not a Cordova environment');
        }
        console.log('Device platform: ' + window.device.platform);
        if (!window.FormData) {
            throw new Error('Missing window.FormData object');
        }
        this.isAndroid = (window.device.platform === 'Android');
        this.isBrowser = (window.device.platform === 'browser');
        this.isIOS = (window.device.platform === 'iOS');
    }

    reportError(err, action) {
        if ((typeof  action === 'string') && action.length > 0) {
            action = action.charAt(0).toLocaleLowerCase() + action.substring(1);
        }
        if (this.opts.get('errors.hide')) {
            err = null;
        }
        if (err != null && typeof err === 'object' && 'messages' in err) {
            err = err['messages'];
        }
        if (err instanceof Messages) {
            if (this.sysopts['messagesReportConsole']) {
                console.warn(err.toString());
            }
            if (this.messagesTag && this.sysopts['messagesReportGUI']) {
                this.messages = err;
                this.messagesTag.update();
                this.popup('#messages');
            }
        } else {
            console.error(`Application error: ${err}\nAction: ${action}`);
            this.alert(`Произошла ошибка${err ? ': ' + err + '.' : '.'} Пожалуйста,
        повторите действие еще раз.`, `Ошибка${action ? ': ' + action : '!'}`);
        }
    }

    showPreloader(title) {
        if (this._preloaders == 0) {
            this._preloaders++;
            return this.fm7.showPreloader(title);
        }
    }

    hidePreloader() {
        if (this._preloaders > 0) {
            this._preloaders = 0;
            return this.fm7.hidePreloader();
        }
    }

    alert(text, title, callbackOk) {
        return this.fm7.alert(text, title, callbackOk);
    };

    confirm(text, title, callbackOk, callbackCancel) {
        return this.fm7.confirm(text, title, callbackOk, callbackCancel);
    }

    loginScreen() {
        return this.fm7.loginScreen();
    }

    closeLoginScreen() {
        return this.fm7.closeLoginScreen();
    }

    popup(selector = '.popup', removeOnClose = true) {
        return this.fm7.popup(selector, removeOnClose);
    }

    pickerModal(selector, removeOnClose = true) {
        return this.fm7.pickerModal(selector, removeOnClose);
    }

    loadTagPage(tagName) {
        return this.router.loadPage(tagName);
    }

    get router() {
        var view = this.fm7.getCurrentView();
        if (view) {
            return view.router;
        } else {
            throw new Error('No current view is set');
        }
    }

    clearHistory() {
        var view = this.fm7.getCurrentView();
        if (view) {
            //todo
        }
    }

    createMessages(src) {
        return new Messages(src);
    }

    translate(msg) {
        return msg;
    }

    translateOrNull(msg) {
        return this.translateOrDefault(msg, null);
    }

    translateOrDefault(msg, def) {
        var ret = this.translate(msg);
        return ret === msg ? def : ret;
    }


    /**
     * Perform GET AJAX request.
     * @param {?string} url Resource URL
     * @param {!object} options Extra request options
     * @returns {Promise}
     */
    ajaxGET(url, options) {
        options = Object.assign({}, options);
        options.url = url;
        return this.ajax(options);
    }

    /**
     * Perform AJAX request.
     * @param options Ajax request options
     * @returns {Promise}
     */
    ajax(options) {
        console.log('AJAX: ' + options.url);
        if (!options.url) {
            throw new Error('Ajax options must contain "url" parameter');
        }
        var app = this;
        return new Promise(function (resolve, reject) {
            var user = options.user, password = options.password,
                    reportMessages = !!options.reportMessages;
            if (user != null) {
                delete options.user;
                delete options.password;
                var headers = options.headers = options.headers || {};
                headers['Authorization'] = 'Basic ' + btoa(user + ':' + password);
            }
            options.success = function (data, status, xhr) {
                var messages = checkResponse(xhr);
                if (reportMessages) {
                    messages.report();
                }
                if (messages.numErrors) {
                    reject({messages, xhr});
                } else {
                    resolve({
                        data,
                        messages,
                        status,
                        xhr
                    });
                }
            };
            options.error = function (xhr, status) {
                var messages = checkResponse(xhr, status, true);
                if (reportMessages) {
                    messages.report();
                }
                reject({messages, xhr});
            };

            function checkResponse(xhr, status, err) {
                var c, mh, messages = [];
                try {
                    if (xhr.getResponseHeader(app.xhdrPrefix + '-Login') != null) {
                        if (app.crm.currentSession) {
                            app.crm.currentSession.destroy();
                            //todo review
                            messages.push({
                                msg: 'User not logged',
                                error: true
                            });
                            return new Messages(messages);
                        }
                    }
                    for (c = 0; (mh = xhr.getResponseHeader(app.xhdrPrefix + '-Err' + c)) != null; ++c) {
                        messages.push({
                            msg: decodeURIComponent(mh.replace(/\+/g, ' ')),
                            error: true
                        });
                    }
                    for (c = 0; (mh = xhr.getResponseHeader(app.xhdrPrefix + '-Msg' + c)) != null; ++c) {
                        messages.push({
                            msg: decodeURIComponent(mh.replace(/\+/g, ' ')),
                            error: false
                        });
                    }
                    if (!messages.length && status && status >= 400 && status !== 404) {
                        messages.push({
                            msg: xhr.statusText || ("" + status),
                            error: true
                        })
                    }
                } catch (e) {
                    console.error(e);
                }
                if (err && messages.length == 0) {
                    messages.push({
                        msg: app.translateOrDefault('fm7.ajax.connection.fail', 'Connection fail'),
                        error: true
                    })
                }

                return new Messages(messages);
            }

            $.ajax(options);
        });
    }

    wa(action, promise) {
        this.showPreloader(action);
        return promise.catch((err) => {
            this.reportError(err, action);
            return err;
        }).finally(() => {
            this.hidePreloader();
        });
    }

    init() {
        var app = this;
        this.checks();
        // Riot tags mixins
        riot.mixin('AppTag', function () {
            this.init = function () {
                app.initAppTagMixin(this);
            }
        });
        // F7 initialization
        (function () {
            app.fm7 = fm7.application(riot,
                    Object.assign({
                        fastClicks: true,
                        modalTitle: app.translateOrNull('fm7.modal.title'),
                        modalPreloaderTitle: app.translateOrNull('fm7.modal.preloader.title'),
                        smartSelectPickerCloseText: app.translateOrNull('fm7.smartselect.picker.close'),
                        smartSelectPopupCloseText: app.translateOrNull('fm7.smartselect.popup.close'),
                        modalButtonOk: app.translateOrNull('fm7.modal.ok'),
                        modalButtonCancel: app.translateOrNull('fm7.modal.cancel'),
                        smartSelectOpenIn: 'picker',
                        preroute(view, options, cb) {
                            console.log('PREROUTE LOAD: ' + JSON.stringify(options));
                            async.applyEachSeries(app.preroutes, view, options, cb);
                        }
                    }, app.sysopts['fm7'])
            );
            app.fm7.addViewTag(app.mainView);
        })();

        if (!this.messagesTag) {
            this.messagesTag = riot.mount('messages')[0];
        }
    }

    initAppTagMixin(mixin) {
        mixin.app = app;
        mixin.tr = (msg) => {
            return this.translate(msg);
        };
    }
}

module.exports = {
    Messages,
    App
};