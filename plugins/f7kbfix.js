// Keyboard fix
// See http://forum.framework7.io/#!/getting-started:pure-js-fix-for-device-scr
const $ = require('Dom7');


module.exports = function (app, params) {
    function handleAppInit() {
        //try to implement js fix for input/text area and mobile screen keyboard
        //use class or element name
        //$(document).on("focus","input,textarea", function(e){
        $(document).on("focus", ".kbdfix", function (e) {
            var el = $(e.target);
            var page = el.closest(".page-content");
            var elTop = el.offset().top;
            //do correction if input at near or below middle of screen
            if (elTop > page.height() / 2 - 20) {
                var delta = page.offset().top + elTop - $(
                                ".statusbar-overlay").height() * (myApp.device.ios ? 2 : 1) - $(".navbar").height(); //minus navbar height?&quest;? 56 fot MD
                var kbdfix = page.find("#keyboard-fix");
                if (kbdfix.length == 0) { //create kbdfix element
                    page.append("<div id='keyboard-fix'></div>");
                }

                $("#keyboard-fix").css("height", delta * 2 + "px");
                page.scrollTop(delta, 300);

            }
        }, true);

        //$(document).on("blur","input,textarea", function(e){
        //call this code in the Back button handler - when it fired for keyboard hidding.
        $(document).on("blur", ".kbdfix", function (e) {
            //reduce all fixes
            $("#keyboard-fix").css("height", "0px");
        }, true);
    }

    return {
        hooks: {
            appInit: handleAppInit
        }
    };
};