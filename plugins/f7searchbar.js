///////////////////////////////////////////////////////////////////////////
//                             Searchbar                                 //
///////////////////////////////////////////////////////////////////////////

const riot = require('riot'),
        $ = require('Dom7');


function SearchBarController($sb, $pageContainer) {
    const s = this;
    riot.observable(s);

    s.$pageContainer = $pageContainer;
    s.$container = $sb;
    s.$input = $sb.find('input[type="search"]');
    s.$clearBt = $sb.find('.searchbar-clear');
    s.$overlay = $pageContainer.find('.searchbar-overlay');
    //todo
    s.$found = $pageContainer.find('.searchbar-found');
    s.$notFound = $pageContainer.find('.searchbar-not-found');
    s.active = false;
    s.query = null;

    function preventSubmit(e) {
        e.preventDefault();
    }

    s.attachEvents = function (destroy) {
        const method = destroy ? 'off' : 'on';
        s.$container[method]('submit', preventSubmit);
        s.$overlay[method]('click', s.disable);
        s.$input[method]('focus', s.enable);
        s.$input[method]('change input', s.handleInput);
        s.$clearBt[method]('click', s.clear);

    };

    s.enable = function (e) {
        if (!s.$container.hasClass('searchbar-active') && !s.query) {
            s.$overlay.addClass('searchbar-overlay-active');
        }
        s.$container.addClass('searchbar-active');
        s.active = true;
        s.trigger('enableSearch', 'onEnable');
    };

    s.disable = function () {
        s.$input.val('').trigger('change');
        s.$container.removeClass('searchbar-active searchbar-not-empty');
        s.$overlay.removeClass('searchbar-overlay-active');
        s.active = false;
        s.$input.blur();
        s.trigger('disableSearch', 'onDisable');
    };

    s.destroy = function () {
        s.attachEvents(true);
    };

    s.clear = function (e) {
        if (!s.query && e && $(e.target).hasClass('searchbar-clear')) {
            s.disable();
            return;
        }
        s.$input.val('').trigger('change').focus();
        s.trigger('clearSearch', 'onClear');
    };

    s.handleInput = function () {
        setTimeout(function () {
            s.search(s.$input.val().trim(), true)
        });
    };

    s.search = function (query, internal) {
        if (query.length === 0) {
            s.$container.removeClass('searchbar-not-empty');
            if (s.$container.hasClass('searchbar-active')) {
                s.$overlay.addClass('searchbar-overlay-active');
            }
        } else {
            s.$container.addClass('searchbar-not-empty');
            if (s.$container.hasClass('searchbar-active')) {
                s.$overlay.removeClass('searchbar-overlay-active');
            }
        }         
        s.query = query;
        s.trigger('search', 'onSearch', {query: query});
    };

    s.attachEvents();
}


function handlePageInit(data) {
    const $pc = $(data.container);
    $pc.find('.searchbar').each(function () {
        const $sb = $(this);
        $sb.data('searchbar', new SearchBarController($sb, $pc));
    });
}

function handlePageBeforeRemove(data) {
    $(data.container).find('.searchbar').each(function () {
        const $sb = $(this);
        const sbc = $sb.data('searchbar');
        if (sbc) {
            sbc.destroy();
            $sb.removeData('searchbar');
        }
    });
}

module.exports = function (app, params) {

    return {
        hooks: {
            pageInit: handlePageInit,
            pageBeforeRemove: handlePageBeforeRemove
        }
    }
};