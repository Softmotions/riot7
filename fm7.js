///////////////////////////////////////////////////////////////////////////
//         Rewrite of the scary Framework7 router for use with RiotJS    //
///////////////////////////////////////////////////////////////////////////

var
        Framework7 = require('Framework7'),
        Template7 = require('Template7'),
        Utils = require('./utils'),
        riot = require('riot'),
        $ = require('Dom7');


function attachOverrides(app) {

    app.popover = function (modal, target, removeOnClose) {

        if (typeof removeOnClose === 'undefined') removeOnClose = true;
        if (typeof modal === 'string' && modal.indexOf('<') >= 0) {
            var _modal = document.createElement('div');
            _modal.innerHTML = modal.trim();
            if (_modal.childNodes.length > 0) {
                modal = _modal.childNodes[0];
                if (removeOnClose) modal.classList.add('remove-on-close');
                $('body').append(modal);
            }
            else return false; //nothing found
        }
        modal = $(modal);
        target = $(target);
        if (modal.length === 0 || target.length === 0) return false;
        if (modal.find('.popover-angle').length === 0 && !app.params.material) {
            modal.append('<div class="popover-angle"></div>');
        }
        modal.show();

        var material = app.params.material;

        function sizePopover() {
            modal.css({left: '', top: ''});
            var modalWidth = modal.width();
            var modalHeight = modal.height(); // 13 - height of angle
            var modalAngle, modalAngleSize = 0, modalAngleLeft, modalAngleTop;
            if (!material) {
                modalAngle = modal.find('.popover-angle');
                modalAngleSize = modalAngle.width() / 2;
                modalAngle.removeClass('on-left on-right on-top on-bottom').css({left: '', top: ''});
            }
            else {
                modal.removeClass('popover-on-left popover-on-right popover-on-top popover-on-bottom').css(
                        {left: '', top: ''});
            }

            var targetWidth = target.outerWidth();
            var targetHeight = target.outerHeight();
            var targetOffset = target.offset();
            var targetParentPage = target.parents('.page');
            if (targetParentPage.length > 0) {
                targetOffset.top = targetOffset.top - targetParentPage[0].scrollTop;
            }

            var windowHeight = $(window).height();
            var windowWidth = $(window).width();

            var modalTop = 0;
            var modalLeft = 0;
            var diff = 0;
            // Top Position
            var modalPosition = material ? 'bottom' : 'top';
            if (material) {
                if (modalHeight < windowHeight - targetOffset.top - targetHeight) {
                    // On bottom
                    modalPosition = 'bottom';
                    modalTop = targetOffset.top;
                    if (target.hasClass('popover-bottom')) {
                        modalTop += targetHeight;
                    }
                }
                else if (modalHeight < targetOffset.top) {
                    // On top
                    modalTop = targetOffset.top - modalHeight + targetHeight;
                    modalPosition = 'top';
                }
                else {
                    // On middle
                    modalPosition = 'bottom';
                    modalTop = targetOffset.top;
                }

                if (modalTop <= 0) {
                    modalTop = 8;
                }
                else if (modalTop + modalHeight >= windowHeight) {
                    modalTop = windowHeight - modalHeight - 8;
                }

                // Horizontal Position
                modalLeft = targetOffset.left;
                if (modalLeft + modalWidth >= windowWidth - 8) {
                    modalLeft = targetOffset.left + targetWidth - modalWidth - 8;
                }
                if (modalLeft < 8) {
                    modalLeft = 8;
                }
                if (modalPosition === 'top') {
                    modal.addClass('popover-on-top');
                }
                if (modalPosition === 'bottom') {
                    modal.addClass('popover-on-bottom');
                }
                if (target.hasClass('floating-button-to-popover') && !modal.hasClass('modal-in')) {
                    modal.addClass('popover-floating-button');
                    var diffX = (modalLeft + modalWidth / 2) - (targetOffset.left + targetWidth / 2),
                            diffY = (modalTop + modalHeight / 2) - (targetOffset.top + targetHeight / 2);
                    target
                    .addClass('floating-button-to-popover-in')
                    .transform('translate3d(' + diffX + 'px, ' + diffY + 'px,0)')
                    .transitionEnd(function (e) {
                        if (!target.hasClass('floating-button-to-popover-in')) return;
                        target
                        .addClass('floating-button-to-popover-scale')
                        .transform(
                                'translate3d(' + diffX + 'px, ' + diffY + 'px,0) scale(' + (modalWidth / targetWidth) + ', ' + (modalHeight / targetHeight) + ')');
                    });

                    modal.once('close', function () {
                        target
                        .removeClass('floating-button-to-popover-in floating-button-to-popover-scale')
                        .addClass('floating-button-to-popover-out')
                        .transform('')
                        .transitionEnd(function (e) {
                            target.removeClass('floating-button-to-popover-out');
                        });
                    });
                    modal.once('closed', function () {
                        modal.removeClass('popover-floating-button');
                    });
                }

            }
            else {
                if ((modalHeight + modalAngleSize) < targetOffset.top) {
                    // On top
                    modalTop = targetOffset.top - modalHeight - modalAngleSize;
                }
                else if ((modalHeight + modalAngleSize) < windowHeight - targetOffset.top - targetHeight) {
                    // On bottom
                    modalPosition = 'bottom';
                    modalTop = targetOffset.top + targetHeight + modalAngleSize;
                }
                else {
                    // On middle
                    modalPosition = 'middle';
                    modalTop = targetHeight / 2 + targetOffset.top - modalHeight / 2;
                    diff = modalTop;
                    if (modalTop <= 0) {
                        modalTop = 5;
                    }
                    else if (modalTop + modalHeight >= windowHeight) {
                        modalTop = windowHeight - modalHeight - 5;
                    }
                    diff = diff - modalTop;
                }

                // Horizontal Position
                if (modalPosition === 'top' || modalPosition === 'bottom') {
                    modalLeft = targetWidth / 2 + targetOffset.left - modalWidth / 2;
                    diff = modalLeft;
                    if (modalLeft < 5) modalLeft = 5;
                    if (modalLeft + modalWidth > windowWidth) modalLeft = windowWidth - modalWidth - 5;
                    if (modalPosition === 'top') {
                        modalAngle.addClass('on-bottom');
                    }
                    if (modalPosition === 'bottom') {
                        modalAngle.addClass('on-top');
                    }
                    diff = diff - modalLeft;
                    modalAngleLeft = (modalWidth / 2 - modalAngleSize + diff);
                    modalAngleLeft = Math.max(Math.min(modalAngleLeft, modalWidth - modalAngleSize * 2 - 13), 13);
                    modalAngle.css({left: modalAngleLeft + 'px'});

                }
                else if (modalPosition === 'middle') {
                    modalLeft = targetOffset.left - modalWidth - modalAngleSize;
                    modalAngle.addClass('on-right');
                    if (modalLeft < 5 || (modalLeft + modalWidth > windowWidth)) {
                        if (modalLeft < 5) modalLeft = targetOffset.left + targetWidth + modalAngleSize;
                        if (modalLeft + modalWidth > windowWidth) modalLeft = windowWidth - modalWidth - 5;
                        modalAngle.removeClass('on-right').addClass('on-left');
                    }
                    modalAngleTop = (modalHeight / 2 - modalAngleSize + diff);
                    modalAngleTop = Math.max(Math.min(modalAngleTop, modalHeight - modalAngleSize * 2 - 13), 13);
                    modalAngle.css({top: modalAngleTop + 'px'});
                }
            }
            // Apply Styles
            modal.css({top: modalTop + 'px', left: modalLeft + 'px'});
        }

        sizePopover();
        $(window).on('resize', sizePopover);
        modal.on('close', function () {
            $(window).off('resize', sizePopover);
        });
        app.openModal(modal);
        return modal[0];
    }
}


function attachRouter(riot, app) {

    app.router = {

        // Set pages classess for animationEnd
        animatePages: function (leftPage, rightPage, direction, view) {
            // Loading new page
            var removeClasses = 'page-on-center page-on-right page-on-left';
            if (direction === 'to-left') {
                leftPage.removeClass(removeClasses).addClass('page-from-center-to-left');
                rightPage.removeClass(removeClasses).addClass('page-from-right-to-center');
            }
            // Go back
            if (direction === 'to-right') {
                leftPage.removeClass(removeClasses).addClass('page-from-left-to-center');
                rightPage.removeClass(removeClasses).addClass('page-from-center-to-right');

            }
        },

        preroute: function (view, options, cb) {
            app.pluginHook('routerPreroute', view, options);
            function dumbPreroute(view, options, cb) {
                cb();
            }

            (app.params.preroute || dumbPreroute)(view, options, function (err) {
                if (err) {
                    cb(err);
                } else {
                    (view.params.preroute || dumbPreroute)(view, options, cb);
                }
            });
        }
    };

    app.router._load = function (view, options) {
        view.tagsCache = view.tagsCache || {};
        options = options || {};
        var url = options.url,
                pageName = options.pageName,
                pagesContainer = $(view.pagesContainer),
                animatePages = (options.animatePages == null ? view.params.animatePages : !!options.animatePages),
                newPage, oldPage, i,
                tagName = options.tagName || options.url,
                newTag, newTagCached = false,
                pageForward = !options.back;

        if (view.tag && typeof view.tag.preroute === 'function') {
            if (!options.force && view.tag.preroute(view, options) === false) {
                view.allowPageChange = true;
                return;
            }
        }

        // Plugin hooks
        if (pageForward) {
            app.pluginHook('routerLoad', view, options);
        } else {
            app.pluginHook('routerBack', view, options);
        }
        newPage = pagesContainer.children(`div.page[data-page="${tagName}"]`);
        if (newPage.length) {
            oldPage = newPage;
            newTag = view.tag;
        } else {
            var $mpoint;
            if (view.tagsCache[options.url]) {
                $mpoint = $(view.tagsCache[options.url].root);
                newTagCached = true;
            } else {
                $mpoint = $(`<div class="page" data-page="${tagName}"></div>`);
            }
            oldPage = pagesContainer.children('div.page').eq(0);
            if (pageForward) {
                pagesContainer.append($mpoint);
            } else {
                pagesContainer.prepend($mpoint);
            }
            if (view.tagsCache[options.url]) {
                newTag = view.tagsCache[options.url];
                delete view.tagsCache[options.url];
            } else {
                newTag = riot.mount(Utils.generateCssSelector($mpoint[0]), tagName, options.query)[0];
                if (!newTag) {
                    view.allowPageChange = true;
                    var err = 'Failed to mount view tag: ' + tagName;
                    console.error(err);
                    return;
                }
                newTag._url = options.url;
                (function (tag) {
                    tag.on('cache', function () {
                        tag.isCached = true;
                    });
                    tag.on('uncache', function () {
                        tag.isCached = false;
                        if (tag._url) {
                            delete view.tagsCache[tag._url];
                        }
                    });
                })(newTag);
            }
            newTag.trigger('view', view);
            newPage = $(newTag.root);
        }

        // Reload position
        if (pageForward) {
            newPage.addClass('page-on-right');
        } else {
            newPage.addClass('page-on-left');
        }

        // Update View history
        view.url = url;
        if (pageForward) {
            view.history.push(url);

        }

        if (oldPage !== newPage && !newTagCached) {
            // Page Init Events
            app.pageInitCallback(view, {
                pageContainer: newPage[0],
                url: url,
                position: 'right',
                query: options.query,
                fromPage: oldPage && oldPage.length && oldPage[0].f7PageData,
                reload: false,
                reloadPrevious: false
            });
        }


        function afterAnimation() {
            view.allowPageChange = true;

            if (pageForward) {    // FORWARD

                newPage
                .removeClass('page-from-right-to-center page-on-right page-on-left')
                .addClass('page-on-center');

                if (newPage !== oldPage) {
                    oldPage
                    .removeClass('page-from-center-to-left page-on-center page-on-right')
                    .addClass('page-on-left');

                    app.pageAnimCallback('after', view, {
                        pageContainer: newPage[0],
                        url: url,
                        position: 'right',
                        oldPage: oldPage,
                        newPage: newPage,
                        query: options.query,
                        fromPage: oldPage.length && oldPage[0].f7PageData
                    });
                }

            } else {                // BACKWARD

                if (newPage !== oldPage) {
                    app.pageBackCallback('after', view, {
                        pageContainer: oldPage[0],
                        url: url,
                        position: 'center',
                        oldPage: oldPage,
                        newPage: newPage
                    });

                    app.pageAnimCallback('after', view, {
                        pageContainer: newPage[0],
                        url: url,
                        position: 'left',
                        oldPage: oldPage,
                        newPage: newPage,
                        query: options.query,
                        fromPage: oldPage && oldPage.length && oldPage[0].f7PageData
                    });
                }

                newPage
                .removeClass('page-from-left-to-center page-on-left')
                .addClass('page-on-center');
                view.history.pop();
            }

            if (newPage != oldPage) {
                if (view.tag) {
                    if (view.tag.isCached === true && view.tag._url) {
                        view.tag.root.parentNode.removeChild(view.tag.root);
                        $(view.tag.root)
                        .removeClass(
                                'page-from-center-to-right ' +
                                'page-from-center-to-left ' +
                                'page-on-right page-on-left');
                        view.tagsCache[view.tag._url] = view.tag;
                        view.tag.trigger('suspend');
                        //todo propagate suspend event recursive!
                        Object.keys(view.tag.tags).forEach(function (tn) {
                            var t = view.tag.tags[tn];
                            if (t) {
                                t.trigger('suspend')
                            }
                        });
                    } else {
                        app.pageRemoveCallback(view, view.tag.root, pageForward ? 'left' : 'right');
                        view.tag.unmount();
                    }
                }
                view.tag = newTag;
            }

            if (newTag) {
                newTag.trigger('activate');
                //todo propagate suspend event recursive!
                Object.keys(newTag.tags).forEach(function (tn) {
                    var t = newTag.tags[tn];
                    if (t) {
                        t.trigger('activate')
                    }
                });
            }
        }

        if (pageForward) {        // FORWARD

            // Before Anim Callback
            app.pageAnimCallback('before', view, {
                pageContainer: newPage[0],
                url: url,
                position: 'right',
                oldPage: oldPage,
                newPage: newPage,
                query: options.query,
                fromPage: oldPage && oldPage.length && oldPage[0].f7PageData
            });

            if (animatePages) {
                if (app.params.material && app.params.materialPageLoadDelay) {
                    setTimeout(function () {
                        app.router.animatePages(oldPage, newPage, 'to-left', view);
                    }, app.params.materialPageLoadDelay);
                } else {
                    app.router.animatePages(oldPage, newPage, 'to-left', view);
                }
                newPage.animationEnd(function (e) {
                    afterAnimation();
                });
            } else {
                afterAnimation();
            }

        } else {                // BACKWARD

            // Page before animation callback
            app.pageBackCallback('before', view, {
                pageContainer: oldPage[0],
                url: url,
                position: 'center',
                oldPage: oldPage,
                newPage: newPage
            });

            app.pageAnimCallback('before', view, {
                pageContainer: newPage[0],
                url: url,
                position: 'left',
                oldPage: oldPage,
                newPage: newPage,
                query: options.query,
                fromPage: oldPage.length && oldPage[0].f7PageData
            });

            if (animatePages && oldPage !== newPage) {
                // Set pages before animation
                app.router.animatePages(newPage, oldPage, 'to-right', view);
                newPage.animationEnd(function () {
                    afterAnimation();
                });
            } else {
                afterAnimation();
            }
        }
    };

    app.router.load = function (view, options) {
        if (!view.allowPageChange) {
            return false;
        }
        options = options || {};
        if (options.content != null) {
            console.log('Trying to load content: ' + options.content);
            throw new Error('Router does not support loading of content');
        }
        if (options.pageName) {
            options.url = options.pageName;
            delete options.pageName;
        }
        if (!options.url) {
            return false;
        }
        var ret = Utils.normalizeTagUrl(options.url);
        options.tagName = ret.url;
        options.query = ret.query;
        if (options.url
                && view.url === options.url
                && !view.params.allowDuplicateUrls) {
            return false;
        }
        app.router.preroute(view, options, (err) => {
            if (!err) {
                view.allowPageChange = false;
                app.router._load(view, options);
            }
        });
        return true;
    };

    app.router.back = function (view, options) {
        options = Object.assign({}, options);
        options.url = ((!options.url || options.url === '#') ? view.history[view.history.length - 2] : options.url);
        options.back = true;
        return app.router.load(view, options);
    };

    return app;
}


function application(riot, opts) {
    var app = attachRouter(riot, new Framework7(
            Object.assign({}, opts, {
                material: true,
                cache: false,
                uniqueHistory: false,
                preloadPreviousPage: false
            })));

    attachOverrides(app);


    var _addView = app.addView;
    app.addView = function (selector, params) {
        var view = _addView.call(app, selector,
                Object.assign({
                    dynamicNavbar: false,
                    domCache: false,
                    reloadPages: false
                }, params)
        );
        view.setViewTag = function (tagName, tagOpts) {
            if (view.tag) {
                app.pageRemoveCallback(view, view.tag.root, 'left');
                view.tag.unmount();
                view.tag = null;
            }

            //reset view history
            view.history = [tagName];

            var pagesContainer = $(view.pagesContainer);
            pagesContainer.children().remove();
            var mpoint = $(`<div class="page" data-page="${tagName}"></div>`);
            pagesContainer.append(mpoint);
            view.tag = riot.mount(Utils.generateCssSelector(mpoint[0]), tagName, tagOpts)[0];
            if (!view.tag) {
                var err = 'Failed to mount view tag: ' + tagName;
                console.error(err);
                throw err;
            }
            view.tag.trigger('view', view);
        };
        return view;
    };

    app.addViewTag = function (tagName, tagOpts, viewOpts) {
        var ret = Utils.addTag('body > div.views', tagName, tagOpts, 'view');
        if (ret) {
            var view = app.addView(ret.selector, viewOpts);
            ret.tag.trigger('view', view);
            return ret;
        }
    };

    app.closeLoginScreen = function (modal) {
        if (!modal) modal = '.login-screen';
        app.closeModal(modal);
    };

    return app;
}

// Activate forms processing plugin
Framework7.prototype.plugins.fm7f = require('./fm7f');

module.exports = {
    attachRouter: attachRouter,
    application: application
};
