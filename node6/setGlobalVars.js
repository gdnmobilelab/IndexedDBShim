'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; }; // Object.assign in EventTarget, etc.


require('babel-polyfill');

var _Event = require('./Event.js');

var _IDBCursor = require('./IDBCursor.js');

var _IDBRequest = require('./IDBRequest.js');

var _IDBFactory = require('./IDBFactory.js');

var _IDBKeyRange = require('./IDBKeyRange.js');

var _IDBKeyRange2 = _interopRequireDefault(_IDBKeyRange);

var _IDBObjectStore = require('./IDBObjectStore.js');

var _IDBObjectStore2 = _interopRequireDefault(_IDBObjectStore);

var _IDBIndex = require('./IDBIndex.js');

var _IDBIndex2 = _interopRequireDefault(_IDBIndex);

var _IDBTransaction = require('./IDBTransaction.js');

var _IDBTransaction2 = _interopRequireDefault(_IDBTransaction);

var _IDBDatabase = require('./IDBDatabase.js');

var _IDBDatabase2 = _interopRequireDefault(_IDBDatabase);

var _polyfill = require('./polyfill.js');

var _polyfill2 = _interopRequireDefault(_polyfill);

var _CFG = require('./CFG.js');

var _CFG2 = _interopRequireDefault(_CFG);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var glob = typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : self;
glob._babelPolyfill = false; // http://stackoverflow.com/questions/31282702/conflicting-use-of-babel-register

var IDB = void 0;

function shim(name, value) {
    try {
        // Try setting the property. This will fail if the property is read-only.
        IDB[name] = value;
    } catch (e) {
        console.log(e);
    }
    if (IDB[name] !== value && Object.defineProperty) {
        // Setting a read-only property failed, so try re-defining the property
        try {
            var desc = { value: value };
            if (name === 'indexedDB') {
                desc.writable = false; // Make explicit for Babel
            }
            Object.defineProperty(IDB, name, desc);
        } catch (e) {
            // With `indexedDB`, PhantomJS fails here and below but
            //  not above, while Chrome is reverse (and Firefox doesn't
            //  get here since no WebSQL to use for shimming)
        }

        if (IDB[name] !== value) {
            typeof console !== 'undefined' && console.warn && console.warn('Unable to shim ' + name);
        }
    }
}

function setGlobalVars(idb) {
    IDB = idb || (typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {});
    shim('shimIndexedDB', _IDBFactory.shimIndexedDB);
    if (IDB.shimIndexedDB) {
        IDB.shimIndexedDB.__useShim = function () {
            if (_CFG2.default.win.openDatabase !== undefined) {
                // Polyfill ALL of IndexedDB, using WebSQL
                shim('indexedDB', _IDBFactory.shimIndexedDB);
                shim('IDBFactory', _IDBFactory.IDBFactory);
                shim('IDBDatabase', _IDBDatabase2.default);
                shim('IDBObjectStore', _IDBObjectStore2.default);
                shim('IDBIndex', _IDBIndex2.default);
                shim('IDBTransaction', _IDBTransaction2.default);
                shim('IDBCursor', _IDBCursor.IDBCursor);
                shim('IDBCursorWithValue', _IDBCursor.IDBCursorWithValue);
                shim('IDBKeyRange', _IDBKeyRange2.default);
                shim('IDBRequest', _IDBRequest.IDBRequest);
                shim('IDBOpenDBRequest', _IDBRequest.IDBOpenDBRequest);
                shim('IDBVersionChangeEvent', _Event.IDBVersionChangeEvent);
            } else if (_typeof(IDB.indexedDB) === 'object') {
                // Polyfill the missing IndexedDB features (no need for IDBEnvironment, the window containing indexedDB itself))
                (0, _polyfill2.default)(_IDBCursor.IDBCursor, _IDBCursor.IDBCursorWithValue, _IDBDatabase2.default, _IDBFactory.IDBFactory, _IDBIndex2.default, _IDBKeyRange2.default, _IDBObjectStore2.default, _IDBRequest.IDBRequest, _IDBTransaction2.default);
            }
        };

        IDB.shimIndexedDB.__debug = function (val) {
            _CFG2.default.DEBUG = val;
        };
        IDB.shimIndexedDB.__setConfig = function (prop, val) {
            _CFG2.default[prop] = val;
        };
        IDB.shimIndexedDB.__getConfig = function (prop) {
            return _CFG2.default[prop];
        };
        IDB.shimIndexedDB.__setUnicodeIdentifiers = function (ui) {
            this.__setConfig('UnicodeIDStart', ui.UnicodeIDStart);
            this.__setConfig('UnicodeIDContinue', ui.UnicodeIDContinue);
        };
    }

    // Workaround to prevent an error in Firefox
    if (!('indexedDB' in IDB)) {
        IDB.indexedDB = IDB.indexedDB || IDB.webkitIndexedDB || IDB.mozIndexedDB || IDB.oIndexedDB || IDB.msIndexedDB;
    }

    // Detect browsers with known IndexedDb issues (e.g. Android pre-4.4)
    var poorIndexedDbSupport = false;
    if (typeof navigator !== 'undefined' && ( // Ignore Node or other environments

    // Bad non-Chrome Android support
    navigator.userAgent.match(/Android (?:2|3|4\.[0-3])/) && !navigator.userAgent.match(/Chrome/) ||
    // Bad non-Safari iOS9 support (see <https://github.com/axemclion/IndexedDBShim/issues/252>)
    (navigator.userAgent.indexOf('Safari') === -1 || navigator.userAgent.indexOf('Chrome') > -1) && // Exclude genuine Safari: http://stackoverflow.com/a/7768006/271577
    // Detect iOS: http://stackoverflow.com/questions/9038625/detect-if-device-is-ios/9039885#9039885
    // and detect version 9: http://stackoverflow.com/a/26363560/271577
    /(iPad|iPhone|iPod).* os 9_/i.test(navigator.userAgent) && !window.MSStream // But avoid IE11
    )) {
            poorIndexedDbSupport = true;
        }
    _CFG2.default.DEFAULT_DB_SIZE = ( // Safari currently requires larger size: (We don't need a larger size for Node as node-websql doesn't use this info)
    // https://github.com/axemclion/IndexedDBShim/issues/41
    // https://github.com/axemclion/IndexedDBShim/issues/115
    typeof navigator !== 'undefined' && navigator.userAgent.indexOf('Safari') > -1 && navigator.userAgent.indexOf('Chrome') === -1 ? 25 : 4) * 1024 * 1024;

    if ((IDB.indexedDB === undefined || !IDB.indexedDB || poorIndexedDbSupport) && _CFG2.default.win.openDatabase !== undefined) {
        IDB.shimIndexedDB.__useShim();
    } else {
        IDB.IDBDatabase = IDB.IDBDatabase || IDB.webkitIDBDatabase;
        IDB.IDBTransaction = IDB.IDBTransaction || IDB.webkitIDBTransaction || {};
        IDB.IDBCursor = IDB.IDBCursor || IDB.webkitIDBCursor;
        IDB.IDBKeyRange = IDB.IDBKeyRange || IDB.webkitIDBKeyRange;
    }
    return IDB;
}

exports.default = setGlobalVars;
module.exports = exports['default'];