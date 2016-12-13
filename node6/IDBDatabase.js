'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _DOMException = require('./DOMException.js');

var _util = require('./util.js');

var util = _interopRequireWildcard(_util);

var _IDBObjectStore = require('./IDBObjectStore.js');

var _IDBObjectStore2 = _interopRequireDefault(_IDBObjectStore);

var _IDBTransaction = require('./IDBTransaction.js');

var _IDBTransaction2 = _interopRequireDefault(_IDBTransaction);

var _CFG = require('./CFG.js');

var _CFG2 = _interopRequireDefault(_CFG);

var _eventtarget = require('eventtarget');

var _eventtarget2 = _interopRequireDefault(_eventtarget);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

/**
 * IDB Database Object
 * http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#database-interface
 * @constructor
 */
function IDBDatabase(db, name, version, storeProperties) {
    this.__db = db;
    this.__closed = false;
    this.__version = version;
    this.__name = name;
    this.onabort = this.onerror = this.onversionchange = null;

    this.__objectStores = {};
    this.__objectStoreNames = new util.StringList();
    const itemCopy = {};
    for (let i = 0; i < storeProperties.rows.length; i++) {
        const item = storeProperties.rows.item(i);
        // Safari implements `item` getter return object's properties
        //  as readonly, so we copy all its properties (except our
        //  custom `currNum` which we don't need) onto a new object
        itemCopy.name = item.name;
        ['keyPath', 'autoInc', 'indexList'].forEach(function (prop) {
            itemCopy[prop] = JSON.parse(item[prop]);
        });
        itemCopy.idbdb = this;
        const store = new _IDBObjectStore2.default(itemCopy);
        this.__objectStores[store.name] = store;
        this.objectStoreNames.push(store.name);
    }
}

/**
 * Creates a new object store.
 * @param {string} storeName
 * @param {object} [createOptions]
 * @returns {IDBObjectStore}
 */
IDBDatabase.prototype.createObjectStore = function (storeName, createOptions) {
    storeName = String(storeName); // W3C test within IDBObjectStore.js seems to accept string conversion
    if (arguments.length === 0) {
        throw new TypeError('No object store name was specified');
    }
    _IDBTransaction2.default.__assertVersionChange(this.__versionTransaction); // this.__versionTransaction may not exist if called mistakenly by user in onsuccess
    _IDBTransaction2.default.__assertActive(this.__versionTransaction);
    if (this.__objectStores[storeName]) {
        throw (0, _DOMException.createDOMException)('ConstraintError', 'Object store "' + storeName + '" already exists in ' + this.name);
    }
    createOptions = Object.assign({}, createOptions);
    if (createOptions.keyPath === undefined) {
        createOptions.keyPath = null;
    }

    const keyPath = createOptions.keyPath;
    const autoIncrement = createOptions.autoIncrement;

    if (keyPath !== null && !util.isValidKeyPath(keyPath)) {
        throw (0, _DOMException.createDOMException)('SyntaxError', 'The keyPath argument contains an invalid key path.');
    }
    if (autoIncrement && (keyPath === '' || Array.isArray(keyPath))) {
        throw (0, _DOMException.createDOMException)('InvalidAccessError', 'With autoIncrement set, the keyPath argument must not be an array or empty string.');
    }

    /** @name IDBObjectStoreProperties **/
    const storeProperties = {
        name: storeName,
        keyPath: keyPath,
        autoInc: autoIncrement,
        indexList: {},
        idbdb: this
    };
    const store = new _IDBObjectStore2.default(storeProperties, this.__versionTransaction);
    _IDBObjectStore2.default.__createObjectStore(this, store);
    return store;
};

/**
 * Deletes an object store.
 * @param {string} storeName
 */
IDBDatabase.prototype.deleteObjectStore = function (storeName) {
    if (arguments.length === 0) {
        throw new TypeError('No object store name was specified');
    }
    _IDBTransaction2.default.__assertVersionChange(this.__versionTransaction);
    _IDBTransaction2.default.__assertActive(this.__versionTransaction);
    delete this.__versionTransaction.__storeClones[storeName];

    const store = this.__objectStores[storeName];
    if (!store) {
        throw (0, _DOMException.createDOMException)('NotFoundError', 'Object store "' + storeName + '" does not exist in ' + this.name);
    }

    _IDBObjectStore2.default.__deleteObjectStore(this, store);
};

IDBDatabase.prototype.close = function () {
    this.__closed = true;
};

/**
 * Starts a new transaction.
 * @param {string|string[]} storeNames
 * @param {string} mode
 * @returns {IDBTransaction}
 */
IDBDatabase.prototype.transaction = function (storeNames, mode) {
    if (typeof mode === 'number') {
        mode = mode === 1 ? 'readwrite' : 'readonly';
        _CFG2.default.DEBUG && console.log('Mode should be a string, but was specified as ', mode); // Todo: Remove this option as no longer in spec
    } else {
        mode = mode || 'readonly';
    }

    if (mode !== 'readonly' && mode !== 'readwrite') {
        throw new TypeError('Invalid transaction mode: ' + mode);
    }

    _IDBTransaction2.default.__assertNotVersionChange(this.__versionTransaction);
    if (this.__closed) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'An attempt was made to start a new transaction on a database connection that is not open');
    }

    storeNames = typeof storeNames === 'string' ? [storeNames] : storeNames;
    storeNames.forEach(storeName => {
        if (!this.objectStoreNames.contains(storeName)) {
            throw (0, _DOMException.createDOMException)('NotFoundError', 'The "' + storeName + '" object store does not exist');
        }
    });
    if (storeNames.length === 0) {
        throw (0, _DOMException.createDOMException)('InvalidAccessError', 'No object store names were specified');
    }
    // Do not set __active flag to false yet: https://github.com/w3c/IndexedDB/issues/87
    return new _IDBTransaction2.default(this, storeNames, mode);
};
IDBDatabase.prototype.toString = function () {
    return '[object IDBDatabase]';
};

util.defineReadonlyProperties(IDBDatabase.prototype, ['name', 'version', 'objectStoreNames']);

Object.assign(IDBDatabase.prototype, _eventtarget2.default.prototype);

exports.default = IDBDatabase;
module.exports = exports['default'];