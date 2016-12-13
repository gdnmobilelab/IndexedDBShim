var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

import { createDOMException } from './DOMException.js';
import * as util from './util.js';
import EventTarget from 'eventtarget';

/**
 * The IDBRequest Object that is returns for all async calls
 * http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#request-api
 */

var IDBRequest = function () {
    function IDBRequest() {
        _classCallCheck(this, IDBRequest);

        this.onsuccess = this.onerror = null;
        this.__result = undefined;
        this.__error = this.__source = this.__transaction = null;
        this.__readyState = 'pending';
        this.__setOptions({ extraProperties: ['debug'] }); // Ensure EventTarget preserves our properties
    }

    _createClass(IDBRequest, [{
        key: 'toString',
        value: function toString() {
            return '[object IDBRequest]';
        }
    }, {
        key: '__getParent',
        value: function __getParent() {
            if (this.toString() === '[object IDBOpenDBRequest]') {
                return null;
            }
            return this.__transaction;
        }
    }]);

    return IDBRequest;
}();

util.defineReadonlyProperties(IDBRequest.prototype, ['source', 'transaction', 'readyState']);

['result', 'error'].forEach(function (prop) {
    var obj = IDBRequest.prototype;
    Object.defineProperty(obj, '__' + prop, {
        enumerable: false,
        configurable: false,
        writable: true
    });
    Object.defineProperty(obj, prop, {
        enumerable: true,
        configurable: true,
        get: function get() {
            if (this.__readyState !== 'done') {
                throw createDOMException('InvalidStateError', 'The request is still pending.');
            }
            return this['__' + prop];
        }
    });
});

Object.assign(IDBRequest.prototype, EventTarget.prototype);

/**
 * The IDBOpenDBRequest called when a database is opened
 */

var IDBOpenDBRequest = function (_IDBRequest) {
    _inherits(IDBOpenDBRequest, _IDBRequest);

    function IDBOpenDBRequest() {
        _classCallCheck(this, IDBOpenDBRequest);

        var _this = _possibleConstructorReturn(this, (IDBOpenDBRequest.__proto__ || Object.getPrototypeOf(IDBOpenDBRequest)).call(this));

        _this.__setOptions({ extraProperties: ['oldVersion', 'newVersion', 'debug'] }); // Ensure EventTarget preserves our properties
        _this.onblocked = _this.onupgradeneeded = null;
        return _this;
    }

    _createClass(IDBOpenDBRequest, [{
        key: 'toString',
        value: function toString() {
            return '[object IDBOpenDBRequest]';
        }
    }]);

    return IDBOpenDBRequest;
}(IDBRequest);

export { IDBRequest, IDBOpenDBRequest };