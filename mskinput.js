// Based on https://github.com/sanniassin/react-input-mask

var $ = require('Dom7');

function maskedInput(domEl, opts) {

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
        /*$input[0].value = */
        state.value = v;
    }

    function isAllowedChar(char, pos, allowMaskChar = false) {
        if (isPermanentChar(pos)) {
            return mask[pos] === char;
        }
        var charRule = charsRules[mask[pos]];
        var ret = (new RegExp(charRule)).test(char || '') || (allowMaskChar && char === maskChar);
        if (ret && opts.filterFn && typeof opts.filterFn === 'function'
                && char != null && char != '' && !/\s/.test(char)) {
            if (!opts.filterFn(char, pos, $input[0].value)) {
                return false;
            }
        }
        return ret;
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
            var isPermanent = isPermanentChar(i);
            if (!isPermanent || mask[i] === substr[0]) {
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
                } else if (maskChar && isPermanent && substr[0] === maskChar) {
                    substr.shift();
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
            pasteText(oldValue, value, pasteSelection, event);
            pasteSelection = null;
            return;
        }

        //todo review it
        if (value != oldValue && $input[0].value == value) {
            value = formatValue(value);
            setValue(value);
            setCaretPos(getFilledLength(value));
            if (typeof opts.onchange === 'function') {
                opts.onchange(event);
            }
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
            event.preventDefault();
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


module.exports = maskedInput;
    
