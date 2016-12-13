var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

import { createEvent, ShimEvent, IDBVersionChangeEvent } from './Event.js';
import { findError, createDOMException, DOMException } from './DOMException.js';
import { IDBOpenDBRequest, IDBRequest } from './IDBRequest.js';
import * as util from './util.js';
import Key from './Key.js';
import IDBTransaction from './IDBTransaction.js';
import IDBDatabase from './IDBDatabase.js';
import CFG from './CFG.js';

var sysdb = void 0;

/**
 * Craetes the sysDB to keep track of version numbers for databases
 **/
function createSysDB(success, failure) {
    function sysDbCreateError() /* tx, err */{
        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
        }

        var err = findError(args);
        CFG.DEBUG && console.log('Error in sysdb transaction - when creating dbVersions', err);
        failure(err);
    }

    if (sysdb) {
        success();
    } else {
        sysdb = CFG.win.openDatabase('__sysdb__.sqlite', 1, 'System Database', CFG.DEFAULT_DB_SIZE);
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
    this.modules = { DOMException: DOMException, Event: typeof Event !== 'undefined' ? Event : ShimEvent, ShimEvent: ShimEvent, IDBFactory: IDBFactory };
}

/**
 * The IndexedDB Method to create a new database and return the DB
 * @param {string} name
 * @param {number} version
 */
IDBFactory.prototype.open = function (name, version) {
    var req = new IDBOpenDBRequest();
    var calledDbCreateError = false;

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

    function dbCreateError() /* tx, err */{
        if (calledDbCreateError) {
            return;
        }

        for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
            args[_key2] = arguments[_key2];
        }

        var err = findError(args);
        calledDbCreateError = true;
        var evt = createEvent('error', args, { bubbles: true });
        req.__readyState = 'done';
        req.__error = err || DOMException;
        req.dispatchEvent(evt);
    }

    function openDB(oldVersion) {
        var db = CFG.win.openDatabase(util.escapeDatabaseName(name), 1, name, CFG.DEFAULT_DB_SIZE);
        req.__readyState = 'done';
        if (version === undefined) {
            version = oldVersion || 1;
        }
        if (oldVersion > version) {
            var err = createDOMException('VersionError', 'An attempt was made to open a database using a lower version than the existing version.', version);
            dbCreateError(err);
            return;
        }

        db.transaction(function (tx) {
            tx.executeSql('CREATE TABLE IF NOT EXISTS __sys__ (name VARCHAR(255), keyPath VARCHAR(255), autoInc BOOLEAN, indexList BLOB, currNum INTEGER)', [], function () {
                tx.executeSql('SELECT * FROM __sys__', [], function (tx, data) {
                    req.__result = new IDBDatabase(db, name, version, data);
                    if (oldVersion < version) {
                        // DB Upgrade in progress
                        sysdb.transaction(function (systx) {
                            systx.executeSql('UPDATE dbVersions SET version = ? WHERE name = ?', [version, name], function () {
                                var e = new IDBVersionChangeEvent('upgradeneeded', { oldVersion: oldVersion, newVersion: version });
                                req.__transaction = req.result.__versionTransaction = new IDBTransaction(req.result, req.result.objectStoreNames, 'versionchange');
                                req.transaction.__addNonRequestToTransactionQueue(function onupgradeneeded(tx, args, success, error) {
                                    req.dispatchEvent(e);
                                    success();
                                });
                                req.transaction.on__beforecomplete = function () {
                                    req.result.__versionTransaction = null;
                                };
                                req.transaction.on__abort = function () {
                                    var err = createDOMException('AbortError', 'The upgrade transaction was aborted.');
                                    dbCreateError(err);
                                };
                                req.transaction.on__complete = function () {
                                    req.__transaction = null;
                                    if (req.__result.__closed) {
                                        var _err = createDOMException('AbortError', 'The connection has been closed.');
                                        dbCreateError(_err);
                                        return;
                                    }
                                    var e = createEvent('success');
                                    req.dispatchEvent(e);
                                };
                            }, dbCreateError);
                        }, dbCreateError);
                    } else {
                        var e = createEvent('success');
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
    var req = new IDBOpenDBRequest();
    var calledDBError = false;
    var version = null;

    if (arguments.length === 0) {
        throw new TypeError('Database name is required');
    }
    name = String(name); // cast to a string

    function dbError() /* tx, err */{
        if (calledDBError) {
            return;
        }

        for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
            args[_key3] = arguments[_key3];
        }

        var err = findError(args);
        req.__readyState = 'done';
        req.__error = err || DOMException;
        var e = createEvent('error', args, { bubbles: true });
        req.dispatchEvent(e);
        calledDBError = true;
    }

    function deleteFromDbVersions() {
        sysdb.transaction(function (systx) {
            systx.executeSql('DELETE FROM dbVersions WHERE name = ? ', [name], function () {
                req.__result = undefined;
                req.__readyState = 'done';
                var e = new IDBVersionChangeEvent('success', { oldVersion: version, newVersion: null });
                req.dispatchEvent(e);
            }, dbError);
        }, dbError);
    }

    createSysDB(function () {
        sysdb.transaction(function (systx) {
            systx.executeSql('SELECT * FROM dbVersions WHERE name = ?', [name], function (tx, data) {
                if (data.rows.length === 0) {
                    req.__result = undefined;
                    var e = new IDBVersionChangeEvent('success', { oldVersion: version, newVersion: null });
                    req.dispatchEvent(e);
                    return;
                }
                version = data.rows.item(0).version;
                var db = CFG.win.openDatabase(util.escapeDatabaseName(name), 1, name, CFG.DEFAULT_DB_SIZE);
                db.transaction(function (tx) {
                    tx.executeSql('SELECT * FROM __sys__', [], function (tx, data) {
                        var tables = data.rows;
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

    Key.convertValueToKey(key1);
    Key.convertValueToKey(key2);
    var encodedKey1 = Key.encode(key1);
    var encodedKey2 = Key.encode(key2);
    var result = encodedKey1 > encodedKey2 ? 1 : encodedKey1 === encodedKey2 ? 0 : -1;

    if (CFG.DEBUG) {
        // verify that the keys encoded correctly
        var decodedKey1 = Key.decode(encodedKey1);
        var decodedKey2 = Key.decode(encodedKey2);
        if ((typeof key1 === 'undefined' ? 'undefined' : _typeof(key1)) === 'object') {
            key1 = JSON.stringify(key1);
            decodedKey1 = JSON.stringify(decodedKey1);
        }
        if ((typeof key2 === 'undefined' ? 'undefined' : _typeof(key2)) === 'object') {
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
    var calledDbCreateError = false;
    function dbGetDatabaseNamesError() /* tx, err */{
        if (calledDbCreateError) {
            return;
        }

        for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
            args[_key4] = arguments[_key4];
        }

        var err = findError(args);
        calledDbCreateError = true;
        var evt = createEvent('error', args, { bubbles: true, cancelable: true }); // http://stackoverflow.com/questions/40165909/to-where-do-idbopendbrequest-error-events-bubble-up/40181108#40181108
        req.__readyState = 'done';
        req.__error = err || DOMException;
        req.dispatchEvent(evt);
    }
    var req = new IDBRequest();
    createSysDB(function () {
        sysdb.transaction(function (tx) {
            tx.executeSql('SELECT name FROM dbVersions', [], function (tx, data) {
                var dbNames = new util.StringList();
                for (var i = 0; i < data.rows.length; i++) {
                    dbNames.push(data.rows.item(i).name);
                }
                req.__result = dbNames;
                req.__readyState = 'done';
                var e = createEvent('success'); // http://stackoverflow.com/questions/40165909/to-where-do-idbopendbrequest-error-events-bubble-up/40181108#40181108
                req.dispatchEvent(e);
            }, dbGetDatabaseNamesError);
        }, dbGetDatabaseNamesError);
    }, dbGetDatabaseNamesError);
    return req;
};

IDBFactory.prototype.toString = function () {
    return '[object IDBFactory]';
};

var shimIndexedDB = new IDBFactory();
export { IDBFactory, cmp, shimIndexedDB };