'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.IDBOpenDBRequest = exports.IDBRequest = undefined;

var _DOMException = require('./DOMException.js');

var _util = require('./util.js');

var util = _interopRequireWildcard(_util);

var _eventtarget = require('eventtarget');

var _eventtarget2 = _interopRequireDefault(_eventtarget);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

/**
 * The IDBRequest Object that is returns for all async calls
 * http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#request-api
 */
class IDBRequest {
    constructor() {
        this.onsuccess = this.onerror = null;
        this.__result = undefined;
        this.__error = this.__source = this.__transaction = null;
        this.__readyState = 'pending';
        this.__setOptions({ extraProperties: ['debug'] }); // Ensure EventTarget preserves our properties
    }
    toString() {
        return '[object IDBRequest]';
    }
    __getParent() {
        if (this.toString() === '[object IDBOpenDBRequest]') {
            return null;
        }
        return this.__transaction;
    }
}

util.defineReadonlyProperties(IDBRequest.prototype, ['source', 'transaction', 'readyState']);

['result', 'error'].forEach(function (prop) {
    const obj = IDBRequest.prototype;
    Object.defineProperty(obj, '__' + prop, {
        enumerable: false,
        configurable: false,
        writable: true
    });
    Object.defineProperty(obj, prop, {
        enumerable: true,
        configurable: true,
        get: function () {
            if (this.__readyState !== 'done') {
                throw (0, _DOMException.createDOMException)('InvalidStateError', 'The request is still pending.');
            }
            return this['__' + prop];
        }
    });
});

Object.assign(IDBRequest.prototype, _eventtarget2.default.prototype);

/**
 * The IDBOpenDBRequest called when a database is opened
 */
class IDBOpenDBRequest extends IDBRequest {
    constructor() {
        super();
        this.__setOptions({ extraProperties: ['oldVersion', 'newVersion', 'debug'] }); // Ensure EventTarget preserves our properties
        this.onblocked = this.onupgradeneeded = null;
    }
    toString() {
        return '[object IDBOpenDBRequest]';
    }
}

exports.IDBRequest = IDBRequest;
exports.IDBOpenDBRequest = IDBOpenDBRequest;