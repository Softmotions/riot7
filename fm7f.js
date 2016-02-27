///////////////////////////////////////////////////////////////////////////
//                    Framework7 forms plugin                            //
///////////////////////////////////////////////////////////////////////////

var
        Utils = require('./utils'),
        $ = require('Dom7'),
        FormValidator = require('validate-js');


class FormSerializer {

    constructor(form) {
        this.form = form;
    }

    serializeAsJSON(options = {}) {
        var $form = $(this.form),
                formData = {},
                skipTypes = ['submit', 'image', 'button', 'file'],
                skipNames = [];

        function processInputVal(name, val) {
            if (typeof options.transform !== 'function') {
                return val;
            }
            return options.transform(name, val);
        }

        function isVisibleFilter(index, el) {
            return (el.offsetParent != null);
        }

        $form.find('input, select, textarea').filter(isVisibleFilter).each(function () {
            var input = $(this);
            var name = input.attr('name');
            var type = input.attr('type');
            var tag = this.nodeName.toLowerCase();
            if (skipTypes.indexOf(type) >= 0) return;
            if (skipNames.indexOf(name) >= 0 || !name) return;
            if (tag === 'select' && input.prop('multiple')) {
                skipNames.push(name);
                formData[name] = [];
                $form.find('select[name="' + name + '"] option').filter(isVisibleFilter).each(function () {
                    if (this.selected) formData[name].push(processInputVal(name, this.value));
                });
            } else {
                switch (type) {
                    case 'checkbox' :
                        skipNames.push(name);
                        formData[name] = [];
                        $form.find('input[name="' + name + '"]').filter(isVisibleFilter).each(function () {
                            if (this.checked) formData[name].push(processInputVal(name, this.value));
                        });
                        break;
                    case 'radio' :
                        skipNames.push(name);
                        $form.find('input[name="' + name + '"]').filter(isVisibleFilter).each(function () {
                            if (this.checked) formData[name] = processInputVal(name, this.value);
                        });
                        break;
                    default :
                        formData[name] = processInputVal(name, input.val());
                        break;
                }
            }
        });
        return formData;
    }

    /**
     * Serialize form as multipart FormData instance including
     * binary photo images within `.photo-box` containers.
     *
     * @param {FormData} formData The populated FormData instance.
     * @param {Object} options Serialization options.
     * @returns {Promise} with passed formData as value
     */
    serializeToFormData(formData, options = {}) {
        var $form = $(this.form),
                promises = [],
                skipTypes = ['submit', 'image', 'button', 'file'],
                skipNames = [];


        function processInputVal(name, val) {
            if (typeof options.transform !== 'function') {
                return val;
            }
            return options.transform(name, val);
        }

        function isVisibleFilter(index, el) {
            return (el.offsetParent != null);
        }

        $form.find('input, select, textarea').filter(isVisibleFilter).each(function () {
            var input = $(this);
            var name = input.attr('name');
            var type = input.attr('type');
            var tag = this.nodeName.toLowerCase();
            if (skipTypes.indexOf(type) >= 0) return;
            if (skipNames.indexOf(name) >= 0 || !name) return;
            if (tag === 'select' && input.prop('multiple')) {
                skipNames.push(name);
                $form.find('select[name="' + name + '"] option').filter(isVisibleFilter).each(function () {
                    if (this.selected) {
                        formData.append(name, processInputVal(name, this.value));
                    }
                });
            } else {
                switch (type) {
                    case 'checkbox' :
                        skipNames.push(name);
                        $form.find('input[name="' + name + '"]').filter(isVisibleFilter).each(function () {
                            if (this.checked) {
                                formData.append(name, processInputVal(name, this.value));
                            }
                        });
                        break;
                    case 'radio' :
                        skipNames.push(name);
                        $form.find('input[name="' + name + '"]').filter(isVisibleFilter).each(function () {
                            if (this.checked) {
                                formData.append(name, processInputVal(name, this.value));
                            }
                        });
                        break;
                    default :
                        formData.append(name, processInputVal(name, input.val()));
                        break;
                }
            }
        });
        promises.push(Promise.resolve());

        $form.find('.photo-box').each(function () {
            var $pbox = $(this),
                    name = $pbox.attr('name') || $pbox.attr('id'),
                    img, blob;
            if (!name) {
                return;
            }
            img = $pbox.children('img')[0];
            if (!img || !img.src) {
                return;
            }
            if (Utils.isDataUrl(img.src)) {
                blob = Utils.dataUrlToBlob(img.src);
                if (blob == null) {
                    return;
                }
                formData.append(name, blob);
                promises.push(Promise.resolve());
            } else {
                promises.push(new Promise((resolve, reject) => {
                    resolveLocalFileSystemURL(img.src, (fileEntry) => {
                        fileEntry.file((file) => {
                            if (app.isBrowser) {
                                formData.append(name, file, file.name);
                                resolve();
                            } else { // Android, iOS
                                var reader = new FileReader();
                                reader.onloadend = (e) => {
                                    formData.append(name,
                                            new Blob([new Uint8Array(e.target.result)], {type: file.type}), file.name);
                                    resolve();
                                };
                                reader.onerror = (e) => {
                                    reject(`Failed to read the file: ${file.localURL} Error: ${e}`);
                                };
                                reader.readAsArrayBuffer(file)
                            }
                        }, reject);
                    }, reject);
                }));
            }
        });

        return Promise.all(promises).then(() => {
            return formData;
        });
    }
}

module.exports = function (app, params) {

    FormValidator.prototype.inputErrors = function (input) {
        if (input == null) {
            return this.errors;
        } else if (typeof input.tagName === 'string') {
            input = $(input);
        }
        if (typeof input.attr === 'function') {
            input = input.attr('name');
        }
        return this.errors.filter(function (e) {
            return (e.name === input);
        });
    };
    FormValidator.registerRule = function (name, hook) {
        FormValidator.prototype._hooks[name] = hook;
    };
    FormValidator.prototype._validateField = function (field) {
        var i, j, ruleLength,
                existingError,
                ruleRegex = /^(.+?)\[(.+)\]$/,
                rules = field.rules.split('|'),
                indexOfRequired = field.rules.indexOf('required'),
                isEmpty = (!field.value || field.value === '' || field.value === undefined);
        for (i = 0, ruleLength = rules.length; i < ruleLength; i++) {
            var method = rules[i],
                    param = null,
                    failed = false,
                    parts = ruleRegex.exec(method);
            if (indexOfRequired === -1 && method.indexOf('!callback_') === -1 && isEmpty) {
                continue;
            }
            if (parts) {
                method = parts[1];
                param = parts[2];
            }
            if (method.charAt(0) === '!') {
                method = method.substring(1, method.length);
            }

            if (typeof this._hooks[method] === 'function') {
                if (!this._hooks[method].apply(this, [field, param])) {
                    failed = true;
                }
            } else if (method.substring(0, 9) === 'callback_') {
                method = method.substring(9, method.length);
                if (typeof this.handlers[method] === 'function') {
                    if (this.handlers[method].apply(this, [field.value, param, field]) === false) {
                        failed = true;
                    }
                }
            }
            if (failed) {
                var source = this.messages[field.name + '.' + method] || this.messages[method] || defaults.messages[method],
                        message = 'An error has occurred with the ' + field.display + ' field.';
                if (source) {
                    message = source.replace('%s', field.display);
                    if (param) {
                        message = message.replace('%s', (this.fields[param]) ? this.fields[param].display : param);
                    }
                }
                existingError = null;
                for (j = 0; j < this.errors.length; j += 1) {
                    if (field.name === this.errors[j].name) {
                        existingError = this.errors[j];
                    }
                }
                var errorObject = existingError || {
                            id: field.id,
                            display: field.display,
                            element: field.element,
                            name: field.name,
                            message: message,
                            messages: [],
                            rule: method
                        };
                errorObject.messages.push(message);
                if (!existingError) this.errors.push(errorObject);
            }
        }
    };

    FormValidator.prototype.isValid = function () {
        return (this.errors.length === 0);
    };

    FormValidator.prototype.validateForm = function (e) {
        return this._validateForm(e);
    };

    //Улучшенный required
    FormValidator.prototype._hooks['required'] = function (field) {
        var value = field.value;
        if ((field.type === 'checkbox') || (field.type === 'radio')) {
            return (field.checked === true);
        }
        return !Utils.isBlank(value);
    };

    //ФИО на русском языке
    FormValidator.prototype._hooks['cyrillicFio'] = function (field) {
        var value = field.value;
        if (Utils.isBlank(value)) {
            return true;
        }
        return (/^[а-яА-ЯёЁ]+(\s*\-?\s*)?[а-яА-ЯёЁ]+$/.test(value.trim()))
    };

    //Поле на русском языке
    FormValidator.prototype._hooks['cyrillic'] = function (field) {
        var value = field.value;
        if (Utils.isBlank(value)) {
            return true;
        }
        return (/^[0-9а-яА-ЯёЁ\.\-\s]+$/.test(value.trim()))
    };

    FormValidator.prototype._hooks['pattern'] = function (field, attr) {
        attr = attr || 'data-validate-pattern-value';
        var value = field.value;
        if (Utils.isBlank(value)) {
            return true;
        }
        var pattern = field.element.getAttribute(attr);
        if (!pattern || pattern == '') {
            console.error('No pattern specified in attr: ' + attr);
            return false;
        }
        return new RegExp(pattern).test(value);
    };

    FormValidator.prototype._hooks['max_age'] = function (field, range) {
        var date = field.element.value;
        if (Utils.isBlank(date)) {
            return true;
        }
        if (!(/^\d{4}\-\d{2}\-\d{2}$/.test(date))) {
            return false;
        }
        var diff = new Date() - new Date(/* we are in UTC */ date.replace(/\-/g, '/'));
        range = range.split('-');
        var min = parseInt(range[0]), max = parseInt(range[1]);
        if (isNaN(min) || isNaN(max)) {
            console.error('Invalid date range specified');
            return false;
        }
        var cyear = new Date(diff).getUTCFullYear() - 1970;
        return (cyear >= min && cyear <= max);
    };

    FormValidator.prototype._hooks['passport'] = function (field, dateField) {
        var sn = field.element.value;
        if (sn) {
            sn = sn.replace(/[\s\/\(\)]/g, '').trim();
        }
        if (Utils.isBlank(sn)) {
            return true;
        }
        if (!/^[0-9]{10}$/.test(sn)) {
            return false;
        }
        dateField = dateField || 'passportIssueDate';
        var issueDate, dateEl = this.form[dateField];
        if (dateEl && dateEl.value && dateEl.value != '') {
            issueDate = new Date(dateEl.value.replace(/\-/g, '/'));
        }
        var seriesFirstHalf = sn.substring(0, 2),
                seriesSecondHalf = sn.substring(2, 4),
                passportNumber = sn.substring(4);
        if (passportNumber === '000000') {
            return false;
        }
        var OKATOCodes = ['01', '03', '04', '05', '07', '08', '10', '11', '12', '14', '15', '17', '18', '19', '20',
            '22', '24', '25', '26', '27', '28', '29', '30', '32', '33', '34', '36', '37', '38', '40', '41', '42',
            '44', '45', '46', '47', '49', '50', '52', '53', '54', '56', '57', '58', '60', '61', '63', '64', '65',
            '66', '68', '69', '70', '71', '73', '75', '76', '77', '78', '79', '80', '81', '82', '83', '84', '85',
            '86', '87', '88', '89', '90', '91', '92', '93', '94', '95', '96', '97', '98', '99'];

        if (OKATOCodes.indexOf(seriesFirstHalf) < 0) {
            return false;
        }
        var currentYearDigit = (new Date()).getUTCFullYear() % 100;
        if ((seriesSecondHalf < 97) && (seriesSecondHalf > currentYearDigit + 3)) {
            return false;
        }
        if (issueDate) {
            var yearDiff = Math.abs(seriesSecondHalf - issueDate.getUTCFullYear() % 100);
            if ((yearDiff > 3) && ((yearDiff < 97) || (seriesSecondHalf))) {
                return false;
            }
        }
        return true;
    };


    FormValidator.prototype.setRUMessages = function () {
        this.messages = {
            passport: 'Некорректное значение серии/номера паспорта',
            max_age: '\'%s\' должна быть в промежутке \'%s\' лет включительно',
            pattern: 'Поле \'%s\' не соответствует шаблону',
            cyrillic: 'Поле \'%s\' должно быть на русском языке',
            cyrillicFio: 'Поле \'%s\' должно быть на русском языке',
            required: 'Поле \'%s\' является обязательным',
            matches: 'Поле \'%s\' не соответствует полю \'%s\'',
            "default": 'Поле \'%s\' установлено по умолчанию, пожулейста измените его',
            valid_email: 'Поле \'%s\' не является валидным email адресом',
            valid_emails: 'В поле \'%s\' не является валидным email адресом (адресами)',
            min_length: 'Поле \'%s\' должно содержать по меньшей мере \'%s\' символов',
            max_length: 'Количество символов в поле \'%s\' превышает максимально допустимые \'%s\' символов',
            exact_length: 'Длина поля \'%s\' должна быть ровно \'%s\' символов',
            greater_than: 'Поле \'%s\' должно содержать число больше чем \'%s\'',
            less_than: 'Поле \'%s\' должно содержать число меньше чем \'%s\'',
            alpha: 'Поле \'%s\' должно содержать только текст',
            alpha_numeric: 'Поле \'%s\' должно содержать только текст и числовые символы',
            alpha_dash: 'Поле \'%s\' должно содержать только текст и числовые символы, подчерки и тире',
            numeric: 'В поле \'%s\' должны быть только цифры',
            integer: 'Поле \'%s\' должно содержать целое число',
            decimal: 'Поле \'%s\' должно содержать цисло',
            is_natural: 'Поле \'%s\' должно содержать неотрицательные числа',
            is_natural_no_zero: 'Поле \'%s\' должно содержать только положительные числа',
            valid_ip: 'В поле \'%s\' должен быть введен IP адрес',
            valid_credit_card: 'Поле \'%s\' должно содержать номер кредитной карточки',
            valid_url: 'Поле \'%s\' не содержит адрес интернет ресурса (URL)'
        };
        return this;
    };

    function syncValidStatus(form, field, errors) {
        if (field.touched) {
            field.touched = errors.length !== 0
        }
        if (!form[field.name]) {
            return;
        }
        var $input = $(form[field.name]),
                $ediv = $input.parent('.item-input').next('.error-label');
        if (!$ediv.length) {
            return;
        }
        //check if input is disabled
        if (!isInputActive($input[0])) {
            $ediv.hide();
            return;
        }
        if (field.touched && errors.length) {
            var msg = $input.attr('data-validate-' + errors[0].rule);
            if (!msg || msg == '') {
                msg = errors[0].message;
            }
            $ediv.text(msg);
            $ediv.show();
        } else {
            $ediv.hide();
        }
    }

    function validateFromInput(input, e, ontimeout) {
        var $input = $(input != null ? input : e),
                $form = $input.parents('form'),
                v = $form.data('validator'),
                name = $input.attr('name');
        if (name && v && v.fields[name]) {
            v.fields[name].touched = true;
            if (e) {
                e.input = $input[0];
            }
            if (!ontimeout || (new Date() - (v.vtime || 0) >= 500)) {
                v.validateForm(e);
            }
        }
        return v;
    }

    function isInputActive(input) {
        return !(input == null || input.offsetParent === null || input.disabled ||
        (input.hasAttribute('readonly') && !input.hasAttribute('data-validate-readonly')));
    }


    function attachMaskedInputs($root) {
        $root.find('input[data-mask]').each(function () {
            var $input = $(this), val;
            var opts = {
                mask: $input.attr('data-mask')
            };
            val = $input.attr('data-mask-char');
            if (val && val.length) {
                opts.maskChar = val;
            }
            Utils.maskedInput($input[0], opts);
        });
    }

    function attach($root) {
        var photoBoxes = {};
        $root.find('form[data-validate]').each(function () {
            var $form = $(this), vrules = [];

            //Accept pseudo-submit controls
            $form.find('.submit').click(function () {
                $form.trigger('_submit_');
            });

            $form.find('input[name]').each(function () {
                var $input = $(this),
                        name = $input.attr('name'),
                        dataset = $input.dataset(),
                        next = (dataset['next'] != null),
                        rules = dataset['validateRules'];
                if (rules != null) {
                    var display = $input.parents('.item-input').eq(0).prev('.item-title').text();
                    if (display == '') {
                        display = null;
                    }
                    vrules.push({
                        name: name,
                        display: display,
                        rules: rules
                    });
                }

                $input[0].addEventListener('blur', function (e) {
                    validateFromInput(e.currentTarget);
                    return true;
                });

                $input[0].addEventListener('keydown', function (e) {
                    var $input = $(e.currentTarget);
                    if (e.keyCode !== 13 && e.keyCode !== 9) {
                        setTimeout(function () {
                            validateFromInput($input[0], null, true);
                        }, 500);
                        return;
                    }
                    var v = validateFromInput($input[0], e),
                            dataNext = $input.attr('data-next'),
                            ierrors = v.inputErrors($input);

                    e.preventDefault();
                    if (dataNext == null || ierrors.length) {
                        return;
                    }
                    var $form = $input.parents("form").eq(0);
                    var inputs = $form.find('input').filter(function () {
                        return isInputActive(this);
                    });
                    var idx = inputs.indexOf($input[0]);
                    if (idx === inputs.length - 1) {
                        if (e.keyCode === 13) {
                            $form.trigger('_submit_');
                        }
                    } else {
                        if (window.Keyboard) {
                            window.Keyboard.hide();
                        }
                        window.setTimeout(function() {
                            inputs[idx + 1].focus();
                        });
                    }
                });
            });

            photoBoxes = {};
            $form.find('div[data-photo-required]').each(function () {
                var $pbox = $(this), name = $pbox.attr('data-photo-required');
                if (name) {
                    photoBoxes[name] = $pbox;
                }
            });
            $form.data('serializer', new FormSerializer($form[0]));
            $form.data('validator', new FormValidator($form[0], vrules, function (errors, e) {
                var v = $form.data('validator'),
                        errmap = {};
                v.vtime = +new Date();

                errors = errors.filter(function (err) {
                    // ensure element is visible
                    return (err.element.offsetParent != null);
                });

                // join fields and errors together
                errors.forEach((err) => {
                    (errmap[err.name] = errmap[err.name] || []).push(err);
                });

                // validate form photos
                for (var pbname in photoBoxes) {
                    var $pbox = photoBoxes[pbname];
                    if ($pbox.find('img[src]').length !== 0) {
                        continue;
                    }
                    var name = $pbox.attr('data-photo-required');
                    errmap[name] = {
                        'name': name,
                        'rule': 'required',
                        'noninput': true
                    };
                }

                $form.trigger(errors.length > 0 ? 'invalid' : 'valid', {
                    form: $form[0],
                    input: (e ? e.input : null),
                    submit: (e ? e.submit : null),
                    errors: errmap,
                    v: v
                });

            }).setRUMessages());

            $form.on('_submit_', function (e) {
                var $form = $(e.currentTarget),
                        v = $form.data('validator');
                if (v && typeof v.validateForm === 'function') {
                    Object.keys(v.fields).forEach(function (fname) {
                        v.fields[fname].touched = isInputActive($form[0][fname]);
                    });
                    e.submit = true;
                    v.validateForm(e);
                }
            });

            $form.on('valid invalid', function (e) {
                var data = e.detail,
                        form = e.currentTarget,
                        v = data.v,
                        success = (e.type === 'valid');



                Object.keys(v.fields).forEach(function (fname) {
                    syncValidStatus(form, v.fields[fname], data.errors[fname] || []);
                });

                //if (v.errors.length > 0 && !data.input) {
                //    var el = form[v.errors[0].name];
                //    if (el) {
                //        el.focus();
                //    }
                //}

                if (data.submit) {
                    // Photo boxes
                    if (!data.input) {
                        Object.keys(photoBoxes).forEach(function (name) {
                            var err = data.errors[name],
                                    $pbox = photoBoxes[name],
                                    $cbt = $pbox.prev('.content-block-title');
                            if (!$cbt.length) {
                                return;
                            }
                            if (err && err.noninput === true) {
                                success = false;
                                $cbt.addClass('error-title');
                            } else {
                                $cbt.removeClass('error-title');
                            }
                        });
                    }

                    if (success) {
                        $form.trigger('formSubmit', $form[0]);
                    }
                }
            });
        });
    }

    function handlePageInit(data) {
        var $root = $(data.container);
        attachMaskedInputs($root);
        attach($root);
    }

    function handlePageBeforeRemove(data) {
        $(data.container).find('form[data-validate]').each(function () {
            var $form = $(this);
            $form.removeData('validator');
            $form.removeData('serializer');
        })
    }

    return {
        hooks: {
            pageInit: handlePageInit,
            pageBeforeRemove: handlePageBeforeRemove
        }
    }
};