'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _DOMException = require('./DOMException.js');

var _IDBCursor = require('./IDBCursor.js');

var _IDBKeyRange = require('./IDBKeyRange.js');

var _util = require('./util.js');

var util = _interopRequireWildcard(_util);

var _Key = require('./Key.js');

var _Key2 = _interopRequireDefault(_Key);

var _IDBIndex = require('./IDBIndex.js');

var _IDBTransaction = require('./IDBTransaction.js');

var _IDBTransaction2 = _interopRequireDefault(_IDBTransaction);

var _Sca = require('./Sca.js');

var _Sca2 = _interopRequireDefault(_Sca);

var _CFG = require('./CFG.js');

var _CFG2 = _interopRequireDefault(_CFG);

var _syncPromise = require('sync-promise');

var _syncPromise2 = _interopRequireDefault(_syncPromise);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

/**
 * IndexedDB Object Store
 * http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#idl-def-IDBObjectStore
 * @param {IDBObjectStoreProperties} storeProperties
 * @param {IDBTransaction} transaction
 * @constructor
 */
function IDBObjectStore(storeProperties, transaction) {
    this.__name = storeProperties.name;
    this.__keyPath = Array.isArray(storeProperties.keyPath) ? storeProperties.keyPath.slice() : storeProperties.keyPath;
    this.__transaction = transaction;
    this.__idbdb = storeProperties.idbdb;
    this.__cursors = storeProperties.cursors || [];

    // autoInc is numeric (0/1) on WinPhone
    this.__autoIncrement = !!storeProperties.autoInc;

    this.__indexes = {};
    this.__indexNames = new util.StringList();
    var indexList = storeProperties.indexList;
    for (var indexName in indexList) {
        if (indexList.hasOwnProperty(indexName)) {
            var index = new _IDBIndex.IDBIndex(this, indexList[indexName]);
            this.__indexes[index.name] = index;
            if (!index.__deleted) {
                this.indexNames.push(index.name);
            }
        }
    }
}

/**
 * Clones an IDBObjectStore instance for a different IDBTransaction instance.
 * @param {IDBObjectStore} store
 * @param {IDBTransaction} transaction
 * @protected
 */
IDBObjectStore.__clone = function (store, transaction) {
    var newStore = new IDBObjectStore({
        name: store.name,
        keyPath: Array.isArray(store.keyPath) ? store.keyPath.slice() : store.keyPath,
        autoInc: store.autoIncrement,
        indexList: {},
        idbdb: store.__idbdb,
        cursors: store.__cursors
    }, transaction);
    newStore.__indexes = store.__indexes;
    newStore.__indexNames = store.indexNames;
    return newStore;
};

/**
 * Creates a new object store in the database.
 * @param {IDBDatabase} db
 * @param {IDBObjectStore} store
 * @protected
 */
IDBObjectStore.__createObjectStore = function (db, store) {
    // Add the object store to the IDBDatabase
    db.__objectStores[store.name] = store;
    db.objectStoreNames.push(store.name);

    // Add the object store to WebSQL
    var transaction = db.__versionTransaction;
    _IDBTransaction2.default.__assertVersionChange(transaction);
    transaction.__addNonRequestToTransactionQueue(function createObjectStore(tx, args, success, failure) {
        function error(tx, err) {
            _CFG2.default.DEBUG && console.log(err);
            throw (0, _DOMException.createDOMException)(0, 'Could not create object store "' + store.name + '"', err);
        }

        // key INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE
        var sql = ['CREATE TABLE', util.escapeStore(store.name), '(key BLOB', store.autoIncrement ? 'UNIQUE, inc INTEGER PRIMARY KEY AUTOINCREMENT' : 'PRIMARY KEY', ', value BLOB)'].join(' ');
        _CFG2.default.DEBUG && console.log(sql);
        tx.executeSql(sql, [], function (tx, data) {
            tx.executeSql('INSERT INTO __sys__ VALUES (?,?,?,?,?)', [store.name, JSON.stringify(store.keyPath), store.autoIncrement, '{}', 1], function () {
                success(store);
            }, error);
        }, error);
    });
};

/**
 * Deletes an object store from the database.
 * @param {IDBDatabase} db
 * @param {IDBObjectStore} store
 * @protected
 */
IDBObjectStore.__deleteObjectStore = function (db, store) {
    // Remove the object store from the IDBDatabase
    store.__deleted = true;
    db.__objectStores[store.name] = undefined;
    db.objectStoreNames.splice(db.objectStoreNames.indexOf(store.name), 1);

    // Remove the object store from WebSQL
    var transaction = db.__versionTransaction;
    _IDBTransaction2.default.__assertVersionChange(transaction);
    transaction.__addNonRequestToTransactionQueue(function deleteObjectStore(tx, args, success, failure) {
        function error(tx, err) {
            _CFG2.default.DEBUG && console.log(err);
            failure((0, _DOMException.createDOMException)(0, 'Could not delete ObjectStore', err));
        }

        tx.executeSql('SELECT * FROM __sys__ WHERE name = ?', [store.name], function (tx, data) {
            if (data.rows.length > 0) {
                tx.executeSql('DROP TABLE ' + util.escapeStore(store.name), [], function () {
                    tx.executeSql('DELETE FROM __sys__ WHERE name = ?', [store.name], function () {
                        success();
                    }, error);
                }, error);
            }
        });
    });
};

/**
 * Determines whether the given inline or out-of-line key is valid, according to the object store's schema.
 * @param {*} value     Used for inline keys
 * @param {*} key       Used for out-of-line keys
 * @private
 */
IDBObjectStore.prototype.__validateKeyAndValue = function (value, key) {
    if (this.keyPath !== null) {
        if (key !== undefined) {
            throw (0, _DOMException.createDOMException)('DataError', 'The object store uses in-line keys and the key parameter was provided', this);
        }
        util.throwIfNotClonable(value, 'The data to be stored could not be cloned by the internal structured cloning algorithm.');
        key = _Key2.default.evaluateKeyPathOnValue(value, this.keyPath);
        if (key === undefined) {
            if (this.autoIncrement) {
                // Todo: Check whether this next check is a problem coming from `IDBCursor.update()`
                if (!util.isObj(value)) {
                    // Although steps for storing will detect this, we want to throw synchronously for `add`/`put`
                    throw (0, _DOMException.createDOMException)('DataError', 'KeyPath was specified, but value was not an object');
                }
                // A key will be generated
                return undefined;
            }
            throw (0, _DOMException.createDOMException)('DataError', 'Could not evaluate a key from keyPath');
        }
        _Key2.default.convertValueToKey(key);
    } else {
        if (key === undefined) {
            if (this.autoIncrement) {
                // A key will be generated
                return undefined;
            }
            throw (0, _DOMException.createDOMException)('DataError', 'The object store uses out-of-line keys and has no key generator and the key parameter was not provided. ', this);
        }
        _Key2.default.convertValueToKey(key);
        util.throwIfNotClonable(value, 'The data to be stored could not be cloned by the internal structured cloning algorithm.');
    }

    return key;
};

/**
 * From the store properties and object, extracts the value for the key in the object store
 * If the table has auto increment, get the current number (unless it has a keyPath leading to a
 *  valid but non-numeric or < 1 key)
 * @param {Object} tx
 * @param {Object} value
 * @param {Object} key
 * @param {function} success
 * @param {function} failure
 */
IDBObjectStore.prototype.__deriveKey = function (tx, value, key, success, failure) {
    var me = this;

    function getCurrentNumber(callback) {
        tx.executeSql('SELECT currNum FROM __sys__ WHERE name = ?', [me.name], function (tx, data) {
            if (data.rows.length !== 1) {
                callback(1);
            } else {
                callback(data.rows.item(0).currNum);
            }
        }, function (tx, error) {
            failure((0, _DOMException.createDOMException)('DataError', 'Could not get the auto increment value for key', error));
        });
    }

    // This variable determines against which key comparisons should be made
    //   when determining whether to update the current number
    var keyToCheck = key;
    var hasKeyPath = me.keyPath !== null;
    if (hasKeyPath) {
        keyToCheck = _Key2.default.evaluateKeyPathOnValue(value, me.keyPath);
    }
    // If auto-increment and no valid primaryKey found on the keyPath, get and set the new value, and use
    if (me.autoIncrement && keyToCheck === undefined) {
        getCurrentNumber(function (cn) {
            if (hasKeyPath) {
                try {
                    // Update the value with the new key
                    _Key2.default.setValue(value, me.keyPath, cn);
                } catch (e) {
                    failure((0, _DOMException.createDOMException)('DataError', 'Could not assign a generated value to the keyPath', e));
                }
            }
            success(cn);
        });
        // If auto-increment and the keyPath item is a valid numeric key, get the old auto-increment to compare if the new is higher
        //  to determine which to use and whether to update the current number
    } else if (me.autoIncrement && Number.isFinite(keyToCheck) && keyToCheck >= 1) {
            getCurrentNumber(function (cn) {
                var useNewForAutoInc = keyToCheck >= cn;
                success(keyToCheck, useNewForAutoInc);
            });
            // Not auto-increment or auto-increment with a bad (non-numeric or < 1) keyPath key
        } else {
                success(keyToCheck);
            }
};

IDBObjectStore.prototype.__insertData = function (tx, encoded, value, primaryKey, passedKey, useNewForAutoInc, success, error) {
    var _this = this;

    var me = this;
    var paramMap = {};
    var indexPromises = me.indexNames.map(function (indexName) {
        return new _syncPromise2.default(function (resolve, reject) {
            var index = me.__indexes[indexName];
            if (index.__pending) {
                resolve();
                return;
            }
            var indexKey = void 0;
            try {
                indexKey = _Key2.default.extractKeyFromValueUsingKeyPath(value, index.keyPath, index.multiEntry); // Add as necessary to this and skip past this index if exceptions here)
            } catch (err) {
                resolve();
                return;
            }
            function setIndexInfo(index) {
                if (indexKey === undefined) {
                    return;
                }
                paramMap[index.name] = _Key2.default.encode(indexKey, index.multiEntry);
            }
            if (index.unique) {
                (function () {
                    var multiCheck = index.multiEntry && Array.isArray(indexKey);
                    var fetchArgs = (0, _IDBIndex.fetchIndexData)(index, true, indexKey, 'key', multiCheck);
                    _IDBIndex.executeFetchIndexData.apply(undefined, _toConsumableArray(fetchArgs).concat([tx, null, function success(key) {
                        if (key === undefined) {
                            setIndexInfo(index);
                            resolve();
                            return;
                        }
                        reject((0, _DOMException.createDOMException)('ConstraintError', 'Index already contains a record equal to ' + (multiCheck ? 'one of the subkeys of' : '') + '`indexKey`'));
                    }, reject]));
                })();
            } else {
                setIndexInfo(index);
                resolve();
            }
        });
    });
    _syncPromise2.default.all(indexPromises).then(function () {
        var sqlStart = ['INSERT INTO ', util.escapeStore(_this.name), '('];
        var sqlEnd = [' VALUES ('];
        var insertSqlValues = [];
        if (primaryKey !== undefined) {
            _Key2.default.convertValueToKey(primaryKey);
            sqlStart.push(util.quote('key'), ',');
            sqlEnd.push('?,');
            insertSqlValues.push(_Key2.default.encode(primaryKey));
        }
        for (var key in paramMap) {
            sqlStart.push(util.escapeIndex(key) + ',');
            sqlEnd.push('?,');
            insertSqlValues.push(paramMap[key]);
        }
        // removing the trailing comma
        sqlStart.push(util.quote('value') + ' )');
        sqlEnd.push('?)');
        insertSqlValues.push(encoded);

        var insertSql = sqlStart.join(' ') + sqlEnd.join(' ');
        _CFG2.default.DEBUG && console.log('SQL for adding', insertSql, insertSqlValues);

        var insert = function insert(result) {
            var cb = void 0;
            if (typeof result === 'function') {
                cb = result;
                result = undefined;
            }
            tx.executeSql(insertSql, insertSqlValues, function (tx, data) {
                if (cb) {
                    cb();
                } else success(result);
            }, function (tx, err) {
                error((0, _DOMException.createDOMException)('ConstraintError', err.message, err));
            });
        };

        // Need for a clone here?
        _Sca2.default.encode(primaryKey, function (primaryKey) {
            primaryKey = _Sca2.default.decode(primaryKey);
            if (!me.autoIncrement) {
                insert(primaryKey);
                return;
            }

            // Bump up the auto-inc counter if the key path-resolved value is valid (greater than old value and >=1) OR
            //  if a manually passed in key is valid (numeric and >= 1) and >= any primaryKey
            // Todo: If primaryKey is not a number, we should be checking the value of any previous "current number" and compare with that
            if (useNewForAutoInc) {
                insert(function () {
                    var sql = 'UPDATE __sys__ SET currNum = ? WHERE name = ?';
                    var sqlValues = [Math.floor(primaryKey) + 1, me.name];
                    _CFG2.default.DEBUG && console.log(sql, sqlValues);
                    tx.executeSql(sql, sqlValues, function (tx, data) {
                        success(primaryKey);
                    }, function (tx, err) {
                        error((0, _DOMException.createDOMException)('UnknownError', 'Could not set the auto increment value for key', err));
                    });
                });
                // If the key path-resolved value is invalid (not numeric or < 1) or
                //    if a manually passed in key is invalid (non-numeric or < 1),
                //    then we don't need to modify the current number
            } else if (useNewForAutoInc === false || !Number.isFinite(primaryKey) || primaryKey < 1) {
                    insert(primaryKey);
                    // Increment current number by 1 (we cannot leverage SQLite's
                    //  autoincrement (and decrement when not needed), as decrementing
                    //  will be overwritten/ignored upon the next insert)
                } else {
                        insert(function () {
                            var sql = 'UPDATE __sys__ SET currNum = currNum + 1 WHERE name = ?';
                            var sqlValues = [me.name];
                            _CFG2.default.DEBUG && console.log(sql, sqlValues);
                            tx.executeSql(sql, sqlValues, function (tx, data) {
                                success(primaryKey);
                            }, function (tx, err) {
                                error((0, _DOMException.createDOMException)('UnknownError', 'Could not set the auto increment value for key', err));
                            });
                        });
                    }
        });
    }).catch(function (err) {
        error(err);
    });
};

IDBObjectStore.prototype.add = function (value, key) {
    var me = this;
    if (arguments.length === 0) {
        throw new TypeError('No value was specified');
    }
    if (me.__deleted) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'This store has been deleted');
    }
    _IDBTransaction2.default.__assertActive(me.transaction);
    me.transaction.__assertWritable();
    this.__validateKeyAndValue(value, key);

    var request = me.transaction.__createRequest(me);
    me.transaction.__pushToQueue(request, function objectStoreAdd(tx, args, success, error) {
        _Sca2.default.encode(value, function (encoded) {
            value = _Sca2.default.decode(encoded);
            me.__deriveKey(tx, value, key, function (primaryKey, useNewForAutoInc) {
                _Sca2.default.encode(value, function (encoded) {
                    me.__insertData(tx, encoded, value, primaryKey, key, useNewForAutoInc, function () {
                        me.__cursors.forEach(function (cursor) {
                            cursor.__addToCache();
                        });
                        /* Key.encode(primaryKey), encoded */success.apply(undefined, arguments);
                    }, error);
                });
            }, error);
        });
    });
    return request;
};

IDBObjectStore.prototype.put = function (value, key) {
    var me = this;
    if (arguments.length === 0) {
        throw new TypeError('No value was specified');
    }
    if (me.__deleted) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'This store has been deleted');
    }
    _IDBTransaction2.default.__assertActive(me.transaction);
    me.transaction.__assertWritable();
    this.__validateKeyAndValue(value, key);

    var request = me.transaction.__createRequest(me);
    me.transaction.__pushToQueue(request, function objectStorePut(tx, args, success, error) {
        _Sca2.default.encode(value, function (encoded) {
            value = _Sca2.default.decode(encoded);
            me.__deriveKey(tx, value, key, function (primaryKey, useNewForAutoInc) {
                _Sca2.default.encode(value, function (encoded) {
                    // First try to delete if the record exists
                    _Key2.default.convertValueToKey(primaryKey);
                    var sql = 'DELETE FROM ' + util.escapeStore(me.name) + ' WHERE key = ?';
                    var encodedPrimaryKey = _Key2.default.encode(primaryKey);
                    tx.executeSql(sql, [encodedPrimaryKey], function (tx, data) {
                        _CFG2.default.DEBUG && console.log('Did the row with the', primaryKey, 'exist? ', data.rowsAffected);
                        me.__insertData(tx, encoded, value, primaryKey, key, useNewForAutoInc, function () {
                            me.__cursors.forEach(function (cursor) {
                                cursor.__addToCache();
                            });
                            /* encodedPrimaryKey, encoded, !!data.rowsAffected */success.apply(undefined, arguments);
                        }, error);
                    }, function (tx, err) {
                        error(err);
                    });
                });
            }, error);
        });
    });
    return request;
};

IDBObjectStore.prototype.get = function (range) {
    var me = this;
    if (!arguments.length) {
        throw new TypeError('A parameter was missing for `IDBObjectStore.get`.');
    }

    if (me.__deleted) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'This store has been deleted');
    }
    _IDBTransaction2.default.__assertActive(me.transaction);
    if (range == null) {
        throw (0, _DOMException.createDOMException)('DataError', 'No key or range was specified');
    }

    if (util.instanceOf(range, _IDBKeyRange.IDBKeyRange)) {
        // We still need to validate IDBKeyRange-like objects (the above check is based on duck-typing)
        if (!range.toString() !== '[object IDBKeyRange]') {
            range = new _IDBKeyRange.IDBKeyRange(range.lower, range.upper, range.lowerOpen, range.upperOpen);
        }
    } else {
        range = _IDBKeyRange.IDBKeyRange.only(range);
    }

    var sql = ['SELECT * FROM ', util.escapeStore(me.name), ' WHERE '];
    var sqlValues = [];
    (0, _IDBKeyRange.setSQLForRange)(range, util.quote('key'), sql, sqlValues);
    sql = sql.join(' ');
    return me.transaction.__addToTransactionQueue(function objectStoreGet(tx, args, success, error) {
        _CFG2.default.DEBUG && console.log('Fetching', me.name, sqlValues);
        tx.executeSql(sql, sqlValues, function (tx, data) {
            _CFG2.default.DEBUG && console.log('Fetched data', data);
            var value = void 0;
            try {
                // Opera can't deal with the try-catch here.
                if (data.rows.length === 0) {
                    return success();
                }

                value = _Sca2.default.decode(data.rows.item(0).value);
            } catch (e) {
                // If no result is returned, or error occurs when parsing JSON
                _CFG2.default.DEBUG && console.log(e);
            }
            success(value);
        }, function (tx, err) {
            error(err);
        });
    }, undefined, me);
};

/*
// Todo: Implement getKey
IDBObjectStore.prototype.getKey = function (query) {
};
*/

/*
// Todo: Implement getAll
IDBObjectStore.prototype.getAll = function (query, count) {
};
*/

/*
// Todo: Implement getAllKeys
IDBObjectStore.prototype.getAllKeys = function (query, count) {
};
*/

IDBObjectStore.prototype['delete'] = function (range) {
    var me = this;
    if (!arguments.length) {
        throw new TypeError('A parameter was missing for `IDBObjectStore.delete`.');
    }

    if (me.__deleted) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'This store has been deleted');
    }
    _IDBTransaction2.default.__assertActive(me.transaction);
    me.transaction.__assertWritable();

    if (range == null) {
        throw (0, _DOMException.createDOMException)('DataError', 'No key or range was specified');
    }

    if (util.instanceOf(range, _IDBKeyRange.IDBKeyRange)) {
        // We still need to validate IDBKeyRange-like objects (the above check is based on duck-typing)
        if (!range.toString() !== '[object IDBKeyRange]') {
            range = new _IDBKeyRange.IDBKeyRange(range.lower, range.upper, range.lowerOpen, range.upperOpen);
        }
    } else {
        range = _IDBKeyRange.IDBKeyRange.only(range);
    }

    var sqlArr = ['DELETE FROM ', util.escapeStore(me.name), ' WHERE '];
    var sqlValues = [];
    (0, _IDBKeyRange.setSQLForRange)(range, util.quote('key'), sqlArr, sqlValues);
    var sql = sqlArr.join(' ');

    return me.transaction.__addToTransactionQueue(function objectStoreDelete(tx, args, success, error) {
        _CFG2.default.DEBUG && console.log('Deleting', me.name, sqlValues);
        tx.executeSql(sql, sqlValues, function (tx, data) {
            _CFG2.default.DEBUG && console.log('Deleted from database', data.rowsAffected);
            me.__cursors.forEach(function (cursor) {
                cursor.__deleteFromCache();
            });
            /* sqlArr, sqlValues */success();
        }, function (tx, err) {
            error(err);
        });
    }, undefined, me);
};

IDBObjectStore.prototype.clear = function () {
    var me = this;
    if (me.__deleted) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'This store has been deleted');
    }
    _IDBTransaction2.default.__assertActive(me.transaction);
    me.transaction.__assertWritable();

    return me.transaction.__addToTransactionQueue(function objectStoreClear(tx, args, success, error) {
        tx.executeSql('DELETE FROM ' + util.escapeStore(me.name), [], function (tx, data) {
            _CFG2.default.DEBUG && console.log('Cleared all records from database', data.rowsAffected);
            me.__cursors.forEach(function (cursor) {
                cursor.__clearFromCache();
            });
            success();
        }, function (tx, err) {
            error(err);
        });
    }, undefined, me);
};

IDBObjectStore.prototype.count = function (key) {
    var me = this;
    if (me.__deleted) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'This store has been deleted');
    }
    _IDBTransaction2.default.__assertActive(me.transaction);
    if (util.instanceOf(key, _IDBKeyRange.IDBKeyRange)) {
        // We still need to validate IDBKeyRange-like objects (the above check is based on duck-typing)
        if (!key.toString() !== '[object IDBKeyRange]') {
            key = new _IDBKeyRange.IDBKeyRange(key.lower, key.upper, key.lowerOpen, key.upperOpen);
        }
        // We don't need to add to cursors array since has the count parameter which won't cache
        return new _IDBCursor.IDBCursorWithValue(key, 'next', this, this, 'key', 'value', true).__req;
    } else {
        var _ret2 = function () {
            var hasKey = key != null;

            // key is optional
            if (hasKey) {
                _Key2.default.convertValueToKey(key);
            }

            return {
                v: me.transaction.__addToTransactionQueue(function objectStoreCount(tx, args, success, error) {
                    var sql = 'SELECT * FROM ' + util.escapeStore(me.name) + (hasKey ? ' WHERE key = ?' : '');
                    var sqlValues = [];
                    hasKey && sqlValues.push(_Key2.default.encode(key));
                    tx.executeSql(sql, sqlValues, function (tx, data) {
                        success(data.rows.length);
                    }, function (tx, err) {
                        error(err);
                    });
                }, undefined, me)
            };
        }();

        if ((typeof _ret2 === 'undefined' ? 'undefined' : _typeof(_ret2)) === "object") return _ret2.v;
    }
};

IDBObjectStore.prototype.openCursor = function (range, direction) {
    if (this.__deleted) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'This store has been deleted');
    }
    var cursor = new _IDBCursor.IDBCursorWithValue(range, direction, this, this, 'key', 'value');
    this.__cursors.push(cursor);
    return cursor.__req;
};

IDBObjectStore.prototype.openKeyCursor = function (range, direction) {
    if (this.__deleted) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'This store has been deleted');
    }
    var cursor = new _IDBCursor.IDBCursor(range, direction, this, this, 'key', 'key');
    this.__cursors.push(cursor);
    return cursor.__req;
};

IDBObjectStore.prototype.index = function (indexName) {
    if (arguments.length === 0) {
        throw new TypeError('No index name was specified');
    }
    if (this.__deleted) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'This store has been deleted');
    }
    _IDBTransaction2.default.__assertActive(this.transaction);
    var index = this.__indexes[indexName];
    if (!index || index.__deleted) {
        throw (0, _DOMException.createDOMException)('NotFoundError', 'Index "' + indexName + '" does not exist on ' + this.name);
    }

    return _IDBIndex.IDBIndex.__clone(index, this);
};

/**
 * Creates a new index on the object store.
 * @param {string} indexName
 * @param {string} keyPath
 * @param {object} optionalParameters
 * @returns {IDBIndex}
 */
IDBObjectStore.prototype.createIndex = function (indexName, keyPath, optionalParameters) {
    indexName = String(indexName); // W3C test within IDBObjectStore.js seems to accept string conversion
    if (arguments.length === 0) {
        throw new TypeError('No index name was specified');
    }
    if (arguments.length === 1) {
        throw new TypeError('No key path was specified');
    }
    _IDBTransaction2.default.__assertVersionChange(this.transaction);
    if (this.__deleted) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'This store has been deleted');
    }
    _IDBTransaction2.default.__assertActive(this.transaction);
    if (this.__indexes[indexName] && !this.__indexes[indexName].__deleted) {
        throw (0, _DOMException.createDOMException)('ConstraintError', 'Index "' + indexName + '" already exists on ' + this.name);
    }
    if (!util.isValidKeyPath(keyPath)) {
        throw (0, _DOMException.createDOMException)('SyntaxError', 'A valid keyPath must be supplied');
    }
    if (Array.isArray(keyPath) && optionalParameters && optionalParameters.multiEntry) {
        throw (0, _DOMException.createDOMException)('InvalidAccessError', 'The keyPath argument was an array and the multiEntry option is true.');
    }

    optionalParameters = optionalParameters || {};
    /** @name IDBIndexProperties **/
    var indexProperties = {
        columnName: indexName,
        keyPath: keyPath,
        optionalParams: {
            unique: !!optionalParameters.unique,
            multiEntry: !!optionalParameters.multiEntry
        }
    };
    var index = new _IDBIndex.IDBIndex(this, indexProperties);
    _IDBIndex.IDBIndex.__createIndex(this, index);
    return index;
};

IDBObjectStore.prototype.deleteIndex = function (indexName) {
    if (arguments.length === 0) {
        throw new TypeError('No index name was specified');
    }
    _IDBTransaction2.default.__assertVersionChange(this.transaction);
    if (this.__deleted) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'This store has been deleted');
    }
    _IDBTransaction2.default.__assertActive(this.transaction);
    var index = this.__indexes[indexName];
    if (!index) {
        throw (0, _DOMException.createDOMException)('NotFoundError', 'Index "' + indexName + '" does not exist on ' + this.name);
    }

    _IDBIndex.IDBIndex.__deleteIndex(this, index);
};

IDBObjectStore.prototype.toString = function () {
    return '[object IDBObjectStore]';
};

util.defineReadonlyProperties(IDBObjectStore.prototype, ['keyPath', 'indexNames', 'transaction', 'autoIncrement']);

Object.defineProperty(IDBObjectStore.prototype, 'name', {
    enumerable: false,
    configurable: false,
    get: function get() {
        return this.__name;
    },
    set: function set(name) {
        var me = this;
        if (this.__deleted) {
            throw (0, _DOMException.createDOMException)('InvalidStateError', 'This store has been deleted');
        }
        _IDBTransaction2.default.__assertVersionChange(this.transaction);
        _IDBTransaction2.default.__assertActive(this.transaction);
        if (me.name === name) {
            return;
        }
        if (me.__idbdb.__objectStores[name]) {
            throw (0, _DOMException.createDOMException)('ConstraintError', 'Object store "' + name + '" already exists in ' + me.__idbdb.name);
        }
        me.__name = name;
        // Todo: Add pending flag to delay queries against this store until renamed in SQLite

        var sql = 'ALTER TABLE ' + util.escapeStore(this.name) + ' RENAME TO ' + util.escapeStore(name);
        me.transaction.__addNonRequestToTransactionQueue(function objectStoreClear(tx, args, success, error) {
            tx.executeSql(sql, [], function (tx, data) {
                success();
            }, function (tx, err) {
                error(err);
            });
        });
    }
});

exports.default = IDBObjectStore;
module.exports = exports['default'];