const Utils = require('./utils'),
        dateFormat = require('dateformat');



function phone(input) {
    if (!input || input.length !== 10) {
        return input;
    }
    return '+7 (' + input.substring(0, 3) + ') '
            + input.substring(3, 6)
            + '-' + input.substring(6, 8)
            + '-' + input.substring(8, 10);
}

function dateDDMMYYYY(input)  {
    return date('mm.dd.yyyy', input);
}

function date(format, input)  {
    if (typeof input === 'string' && Utils.isBlank(input)) {
        return null;
    }
    let date = Utils.toDate(input);
    if (!date) {
        return date;
    }
    return dateFormat(date, format);
}


module.exports = {
    phone,
    dateDDMMYYYY,
    date
};