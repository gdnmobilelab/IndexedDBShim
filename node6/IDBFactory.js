'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.shimIndexedDB = exports.cmp = exports.IDBFactory = undefined;

var _Event = require('./Event.js');

var _DOMException = require('./DOMException.js');

var _IDBRequest = require('./IDBRequest.js');

var _util = require('./util.js');

var util = _interopRequireWildcard(_util);

var _Key = require('./Key.js');

var _Key2 = _interopRequireDefault(_Key);

var _IDBTransaction = require('./IDBTransaction.js');

var _IDBTransaction2 = _interopRequireDefault(_IDBTransaction);

var _IDBDatabase = require('./IDBDatabase.js');

var _IDBDatabase2 = _interopRequireDefault(_IDBDatabase);

var _CFG = require('./CFG.js');

var _CFG2 = _interopRequireDefault(_CFG);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

let sysdb;

/**
 * Craetes the sysDB to keep track of version numbers for databases
 **/
function createSysDB(success, failure) {
    function sysDbCreateError(...args /* tx, err */) {
        const err = (0, _DOMException.findError)(args);
        _CFG2.default.DEBUG && console.log('Error in sysdb transaction - when creating dbVersions', err);
        failure(err);
    }

    if (sysdb) {
        success();
    } else {
        sysdb = _CFG2.default.win.openDatabase('__sysdb__.sqlite', 1, 'System Database', _CFG2.default.DEFAULT_DB_SIZE);
        sysdb.transaction(function (tx) {
            tx.executeSql('CREATE TABLE IF NOT EXISTS dbVersions (name VARCHAR(255), version INT);', [], success, sysDbCreateError);
        }, sysDbCreateError);
    }
}

/**
 * IDBFactory Class
 * https://w3c.github.io/IndexedDB/#idl-def-IDBFactory
 * @constructor
 */
function IDBFactory() {
    this.modules = { DOMException: _DOMException.DOMException, Event: typeof Event !== 'undefined' ? Event : _Event.ShimEvent, ShimEvent: _Event.ShimEvent, IDBFactory };
}

/**
 * The IndexedDB Method to create a new database and return the DB
 * @param {string} name
 * @param {number} version
 */
IDBFactory.prototype.open = function (name, version) {
    const req = new _IDBRequest.IDBOpenDBRequest();
    let calledDbCreateError = false;

    if (arguments.length === 0) {
        throw new TypeError('Database name is required');
    } else if (arguments.length >= 2) {
        version = Number(version);
        if (isNaN(version) || !isFinite(version) || version >= 0x20000000000000 || // 2 ** 53
        version < 1) {
            // The spec only mentions version==0 as throwing, but W3C tests fail with these
            throw new TypeError('Invalid database version: ' + version);
        }
    }
    name = String(name); // cast to a string

    function dbCreateError(...args /* tx, err */) {
        if (calledDbCreateError) {
            return;
        }
        const err = (0, _DOMException.findError)(args);
        calledDbCreateError = true;
        const evt = (0, _Event.createEvent)('error', args, { bubbles: true });
        req.__readyState = 'done';
        req.__error = err || _DOMException.DOMException;
        req.dispatchEvent(evt);
    }

    function openDB(oldVersion) {
        const db = _CFG2.default.win.openDatabase(util.escapeDatabaseName(name), 1, name, _CFG2.default.DEFAULT_DB_SIZE);
        req.__readyState = 'done';
        if (version === undefined) {
            version = oldVersion || 1;
        }
        if (oldVersion > version) {
            const err = (0, _DOMException.createDOMException)('VersionError', 'An attempt was made to open a database using a lower version than the existing version.', version);
            dbCreateError(err);
            return;
        }

        db.transaction(function (tx) {
            tx.executeSql('CREATE TABLE IF NOT EXISTS __sys__ (name VARCHAR(255), keyPath VARCHAR(255), autoInc BOOLEAN, indexList BLOB, currNum INTEGER)', [], function () {
                tx.executeSql('SELECT * FROM __sys__', [], function (tx, data) {
                    req.__result = new _IDBDatabase2.default(db, name, version, data);
                    if (oldVersion < version) {
                        // DB Upgrade in progress
                        sysdb.transaction(function (systx) {
                            systx.executeSql('UPDATE dbVersions SET version = ? WHERE name = ?', [version, name], function () {
                                const e = new _Event.IDBVersionChangeEvent('upgradeneeded', { oldVersion, newVersion: version });
                                req.__transaction = req.result.__versionTransaction = new _IDBTransaction2.default(req.result, req.result.objectStoreNames, 'versionchange');
                                req.transaction.__addNonRequestToTransactionQueue(function onupgradeneeded(tx, args, success, error) {
                                    req.dispatchEvent(e);
                                    success();
                                });
                                req.transaction.on__beforecomplete = function () {
                                    req.result.__versionTransaction = null;
                                };
                                req.transaction.on__abort = function () {
                                    const err = (0, _DOMException.createDOMException)('AbortError', 'The upgrade transaction was aborted.');
                                    dbCreateError(err);
                                };
                                req.transaction.on__complete = function () {
                                    req.__transaction = null;
                                    if (req.__result.__closed) {
                                        const err = (0, _DOMException.createDOMException)('AbortError', 'The connection has been closed.');
                                        dbCreateError(err);
                                        return;
                                    }
                                    const e = (0, _Event.createEvent)('success');
                                    req.dispatchEvent(e);
                                };
                            }, dbCreateError);
                        }, dbCreateError);
                    } else {
                        const e = (0, _Event.createEvent)('success');
                        req.dispatchEvent(e);
                    }
                }, dbCreateError);
            }, dbCreateError);
        }, dbCreateError);
    }

    createSysDB(function () {
        sysdb.transaction(function (tx) {
            tx.executeSql('SELECT * FROM dbVersions WHERE name = ?', [name], function (tx, data) {
                if (data.rows.length === 0) {
                    // Database with this name does not exist
                    tx.executeSql('INSERT INTO dbVersions VALUES (?,?)', [name, version || 1], function () {
                        openDB(0);
                    }, dbCreateError);
                } else {
                    openDB(data.rows.item(0).version);
                }
            }, dbCreateError);
        }, dbCreateError);
    }, dbCreateError);

    return req;
};

/**
 * Deletes a database
 * @param {string} name
 * @returns {IDBOpenDBRequest}
 */
IDBFactory.prototype.deleteDatabase = function (name) {
    const req = new _IDBRequest.IDBOpenDBRequest();
    let calledDBError = false;
    let version = null;

    if (arguments.length === 0) {
        throw new TypeError('Database name is required');
    }
    name = String(name); // cast to a string

    function dbError(...args /* tx, err */) {
        if (calledDBError) {
            return;
        }
        const err = (0, _DOMException.findError)(args);
        req.__readyState = 'done';
        req.__error = err || _DOMException.DOMException;
        const e = (0, _Event.createEvent)('error', args, { bubbles: true });
        req.dispatchEvent(e);
        calledDBError = true;
    }

    function deleteFromDbVersions() {
        sysdb.transaction(function (systx) {
            systx.executeSql('DELETE FROM dbVersions WHERE name = ? ', [name], function () {
                req.__result = undefined;
                req.__readyState = 'done';
                const e = new _Event.IDBVersionChangeEvent('success', { oldVersion: version, newVersion: null });
                req.dispatchEvent(e);
            }, dbError);
        }, dbError);
    }

    createSysDB(function () {
        sysdb.transaction(function (systx) {
            systx.executeSql('SELECT * FROM dbVersions WHERE name = ?', [name], function (tx, data) {
                if (data.rows.length === 0) {
                    req.__result = undefined;
                    const e = new _Event.IDBVersionChangeEvent('success', { oldVersion: version, newVersion: null });
                    req.dispatchEvent(e);
                    return;
                }
                version = data.rows.item(0).version;
                const db = _CFG2.default.win.openDatabase(util.escapeDatabaseName(name), 1, name, _CFG2.default.DEFAULT_DB_SIZE);
                db.transaction(function (tx) {
                    tx.executeSql('SELECT * FROM __sys__', [], function (tx, data) {
                        const tables = data.rows;
                        (function deleteTables(i) {
                            if (i >= tables.length) {
                                // If all tables are deleted, delete the housekeeping tables
                                tx.executeSql('DROP TABLE IF EXISTS __sys__', [], function () {
                                    // Finally, delete the record for this DB from sysdb
                                    deleteFromDbVersions();
                                }, dbError);
                            } else {
                                // Delete all tables in this database, maintained in the sys table
                                tx.executeSql('DROP TABLE ' + util.escapeStore(tables.item(i).name), [], function () {
                                    deleteTables(i + 1);
                                }, function () {
                                    deleteTables(i + 1);
                                });
                            }
                        })(0);
                    }, function (e) {
                        // __sysdb table does not exist, but that does not mean delete did not happen
                        deleteFromDbVersions();
                    });
                });
            }, dbError);
        }, dbError);
    }, dbError);

    return req;
};

/**
 * Compares two keys
 * @param key1
 * @param key2
 * @returns {number}
 */
function cmp(key1, key2) {
    if (arguments.length < 2) {
        throw new TypeError('You must provide two keys to be compared');
    }

    _Key2.default.convertValueToKey(key1);
    _Key2.default.convertValueToKey(key2);
    const encodedKey1 = _Key2.default.encode(key1);
    const encodedKey2 = _Key2.default.encode(key2);
    const result = encodedKey1 > encodedKey2 ? 1 : encodedKey1 === encodedKey2 ? 0 : -1;

    if (_CFG2.default.DEBUG) {
        // verify that the keys encoded correctly
        let decodedKey1 = _Key2.default.decode(encodedKey1);
        let decodedKey2 = _Key2.default.decode(encodedKey2);
        if (typeof key1 === 'object') {
            key1 = JSON.stringify(key1);
            decodedKey1 = JSON.stringify(decodedKey1);
        }
        if (typeof key2 === 'object') {
            key2 = JSON.stringify(key2);
            decodedKey2 = JSON.stringify(decodedKey2);
        }

        // encoding/decoding mismatches are usually due to a loss of floating-point precision
        if (decodedKey1 !== key1) {
            console.warn(key1 + ' was incorrectly encoded as ' + decodedKey1);
        }
        if (decodedKey2 !== key2) {
            console.warn(key2 + ' was incorrectly encoded as ' + decodedKey2);
        }
    }

    return result;
}

IDBFactory.prototype.cmp = cmp;

/**
* NON-STANDARD!! (Also may return outdated information if a database has since been deleted)
* @link https://www.w3.org/Bugs/Public/show_bug.cgi?id=16137
* @link http://lists.w3.org/Archives/Public/public-webapps/2011JulSep/1537.html
*/
IDBFactory.prototype.webkitGetDatabaseNames = function () {
    let calledDbCreateError = false;
    function dbGetDatabaseNamesError(...args /* tx, err */) {
        if (calledDbCreateError) {
            return;
        }
        const err = (0, _DOMException.findError)(args);
        calledDbCreateError = true;
        const evt = (0, _Event.createEvent)('error', args, { bubbles: true, cancelable: true }); // http://stackoverflow.com/questions/40165909/to-where-do-idbopendbrequest-error-events-bubble-up/40181108#40181108
        req.__readyState = 'done';
        req.__error = err || _DOMException.DOMException;
        req.dispatchEvent(evt);
    }
    const req = new _IDBRequest.IDBRequest();
    createSysDB(function () {
        sysdb.transaction(function (tx) {
            tx.executeSql('SELECT name FROM dbVersions', [], function (tx, data) {
                const dbNames = new util.StringList();
                for (let i = 0; i < data.rows.length; i++) {
                    dbNames.push(data.rows.item(i).name);
                }
                req.__result = dbNames;
                req.__readyState = 'done';
                const e = (0, _Event.createEvent)('success'); // http://stackoverflow.com/questions/40165909/to-where-do-idbopendbrequest-error-events-bubble-up/40181108#40181108
                req.dispatchEvent(e);
            }, dbGetDatabaseNamesError);
        }, dbGetDatabaseNamesError);
    }, dbGetDatabaseNamesError);
    return req;
};

IDBFactory.prototype.toString = function () {
    return '[object IDBFactory]';
};

const shimIndexedDB = new IDBFactory();
exports.IDBFactory = IDBFactory;
exports.cmp = cmp;
exports.shimIndexedDB = shimIndexedDB;