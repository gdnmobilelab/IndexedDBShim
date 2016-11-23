'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = exports.IDBKeyRange = exports.setSQLForRange = undefined;

var _DOMException = require('./DOMException.js');

var _Key = require('./Key.js');

var _Key2 = _interopRequireDefault(_Key);

var _util = require('./util.js');

var util = _interopRequireWildcard(_util);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * The IndexedDB KeyRange object
 * http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#dfn-key-range
 * @param {Object} lower
 * @param {Object} upper
 * @param {Object} lowerOpen
 * @param {Object} upperOpen
 */
function IDBKeyRange(lower, upper, lowerOpen, upperOpen) {
    if (lower === undefined && upper === undefined) {
        throw new TypeError('Both arguments to the key range method cannot be undefined');
    }
    if (lower !== undefined) {
        _Key2.default.convertValueToKey(lower);
    }
    if (upper !== undefined) {
        _Key2.default.convertValueToKey(upper);
    }
    if (lower !== undefined && upper !== undefined && lower !== upper) {
        if (_Key2.default.encode(lower) > _Key2.default.encode(upper)) {
            throw (0, _DOMException.createDOMException)('DataError', '`lower` must not be greater than `upper` argument in `bound()` call.');
        }
    }

    this.__lower = lower;
    this.__upper = upper;
    this.__lowerOpen = !!lowerOpen;
    this.__upperOpen = !!upperOpen;
}
IDBKeyRange.prototype.includes = function (key) {
    _Key2.default.convertValueToKey(key);
    return _Key2.default.isKeyInRange(key, this);
};

IDBKeyRange.only = function (value) {
    return new IDBKeyRange(value, value, false, false);
};

IDBKeyRange.lowerBound = function (value, open) {
    return new IDBKeyRange(value, undefined, open, true);
};
IDBKeyRange.upperBound = function (value, open) {
    return new IDBKeyRange(undefined, value, true, open);
};
IDBKeyRange.bound = function (lower, upper, lowerOpen, upperOpen) {
    return new IDBKeyRange(lower, upper, lowerOpen, upperOpen);
};
IDBKeyRange.prototype.toString = function () {
    return '[object IDBKeyRange]';
};

util.defineReadonlyProperties(IDBKeyRange.prototype, ['lower', 'upper', 'lowerOpen', 'upperOpen']);

Object.defineProperty(IDBKeyRange, Symbol.hasInstance, {
    value: function value(obj) {
        return util.isObj(obj) && 'upper' in obj && typeof obj.lowerOpen === 'boolean';
    }
});

function setSQLForRange(range, quotedKeyColumnName, sql, sqlValues, addAnd, checkCached) {
    if (range && (range.lower !== undefined || range.upper !== undefined)) {
        if (addAnd) sql.push('AND');
        if (range.lower !== undefined) {
            sql.push(quotedKeyColumnName, range.lowerOpen ? '>' : '>=', '?');
            sqlValues.push(checkCached ? range.__lowerCached : _Key2.default.encode(range.lower));
        }
        range.lower !== undefined && range.upper !== undefined && sql.push('AND');
        if (range.upper !== undefined) {
            sql.push(quotedKeyColumnName, range.upperOpen ? '<' : '<=', '?');
            sqlValues.push(checkCached ? range.__upperCached : _Key2.default.encode(range.upper));
        }
    }
}

exports.setSQLForRange = setSQLForRange;
exports.IDBKeyRange = IDBKeyRange;
exports.default = IDBKeyRange;