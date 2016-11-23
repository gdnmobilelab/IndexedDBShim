'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = exports.IDBIndex = exports.executeFetchIndexData = exports.fetchIndexData = undefined;

var _DOMException = require('./DOMException.js');

var _IDBCursor = require('./IDBCursor.js');

var _util = require('./util.js');

var util = _interopRequireWildcard(_util);

var _Key = require('./Key.js');

var _Key2 = _interopRequireDefault(_Key);

var _IDBKeyRange = require('./IDBKeyRange.js');

var _Sca = require('./Sca.js');

var _Sca2 = _interopRequireDefault(_Sca);

var _CFG = require('./CFG.js');

var _CFG2 = _interopRequireDefault(_CFG);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

/**
 * IDB Index
 * http://www.w3.org/TR/IndexedDB/#idl-def-IDBIndex
 * @param {IDBObjectStore} store
 * @param {IDBIndexProperties} indexProperties
 * @constructor
 */
function IDBIndex(store, indexProperties) {
    this.__objectStore = store;
    this.__name = indexProperties.columnName;
    this.__keyPath = Array.isArray(indexProperties.keyPath) ? indexProperties.keyPath.slice() : indexProperties.keyPath;
    var optionalParams = indexProperties.optionalParams;
    this.__multiEntry = !!(optionalParams && optionalParams.multiEntry);
    this.__unique = !!(optionalParams && optionalParams.unique);
    this.__deleted = !!indexProperties.__deleted;
    this.__objectStore.__cursors = indexProperties.cursors || [];
}

/**
 * Clones an IDBIndex instance for a different IDBObjectStore instance.
 * @param {IDBIndex} index
 * @param {IDBObjectStore} store
 * @protected
 */
IDBIndex.__clone = function (index, store) {
    return new IDBIndex(store, {
        columnName: index.name,
        keyPath: index.keyPath,
        optionalParams: {
            multiEntry: index.multiEntry,
            unique: index.unique
        }
    });
};

/**
 * Creates a new index on an object store.
 * @param {IDBObjectStore} store
 * @param {IDBIndex} index
 * @returns {IDBIndex}
 * @protected
 */
IDBIndex.__createIndex = function (store, index) {
    var columnExists = !!store.__indexes[index.name] && store.__indexes[index.name].__deleted;

    // Add the index to the IDBObjectStore
    index.__pending = true;
    store.__indexes[index.name] = index;
    store.indexNames.push(index.name);

    // Create the index in WebSQL
    var transaction = store.transaction;
    transaction.__addNonRequestToTransactionQueue(function createIndex(tx, args, success, failure) {
        function error(tx, err) {
            failure((0, _DOMException.createDOMException)(0, 'Could not create index "' + index.name + '"', err));
        }

        function applyIndex(tx) {
            // Update the object store's index list
            IDBIndex.__updateIndexList(store, tx, function () {
                // Add index entries for all existing records
                tx.executeSql('SELECT * FROM ' + util.escapeStore(store.name), [], function (tx, data) {
                    _CFG2.default.DEBUG && console.log('Adding existing ' + store.name + ' records to the ' + index.name + ' index');
                    addIndexEntry(0);

                    function addIndexEntry(i) {
                        if (i < data.rows.length) {
                            try {
                                var value = _Sca2.default.decode(data.rows.item(i).value);
                                var indexKey = _Key2.default.evaluateKeyPathOnValue(value, index.keyPath, index.multiEntry);
                                indexKey = _Key2.default.encode(indexKey, index.multiEntry);

                                tx.executeSql('UPDATE ' + util.escapeStore(store.name) + ' SET ' + util.escapeIndex(index.name) + ' = ? WHERE key = ?', [indexKey, data.rows.item(i).key], function (tx, data) {
                                    addIndexEntry(i + 1);
                                }, error);
                            } catch (e) {
                                // Not a valid value to insert into index, so just continue
                                addIndexEntry(i + 1);
                            }
                        } else {
                            delete index.__pending;
                            success(store);
                        }
                    }
                }, error);
            }, error);
        }

        if (columnExists) {
            // For a previously existing index, just update the index entries in the existing column
            applyIndex(tx);
        } else {
            // For a new index, add a new column to the object store, then apply the index
            var sql = ['ALTER TABLE', util.escapeStore(store.name), 'ADD', util.escapeIndex(index.name), 'BLOB'].join(' ');
            _CFG2.default.DEBUG && console.log(sql);
            tx.executeSql(sql, [], applyIndex, error);
        }
    }, undefined, store);
};

/**
 * Deletes an index from an object store.
 * @param {IDBObjectStore} store
 * @param {IDBIndex} index
 * @protected
 */
IDBIndex.__deleteIndex = function (store, index) {
    // Remove the index from the IDBObjectStore
    store.__indexes[index.name].__deleted = true;
    store.indexNames.splice(store.indexNames.indexOf(index.name), 1);

    // Remove the index in WebSQL
    var transaction = store.transaction;
    transaction.__addNonRequestToTransactionQueue(function deleteIndex(tx, args, success, failure) {
        function error(tx, err) {
            failure((0, _DOMException.createDOMException)(0, 'Could not delete index "' + index.name + '"', err));
        }

        // Update the object store's index list
        IDBIndex.__updateIndexList(store, tx, success, error);
    }, undefined, store);
};

/**
 * Updates index list for the given object store.
 * @param {IDBObjectStore} store
 * @param {object} tx
 * @param {function} success
 * @param {function} failure
 */
IDBIndex.__updateIndexList = function (store, tx, success, failure) {
    var indexList = {};
    for (var i = 0; i < store.indexNames.length; i++) {
        var idx = store.__indexes[store.indexNames[i]];
        /** @type {IDBIndexProperties} **/
        indexList[idx.name] = {
            columnName: idx.name,
            keyPath: idx.keyPath,
            optionalParams: {
                unique: idx.unique,
                multiEntry: idx.multiEntry
            },
            deleted: !!idx.deleted
        };
    }

    _CFG2.default.DEBUG && console.log('Updating the index list for ' + store.name, indexList);
    tx.executeSql('UPDATE __sys__ SET indexList = ? WHERE name = ?', [JSON.stringify(indexList), store.name], function () {
        success(store);
    }, failure);
};

/**
 * Retrieves index data for the given key
 * @param {*|IDBKeyRange} key
 * @param {string} opType
 * @returns {IDBRequest}
 * @private
 */
IDBIndex.prototype.__fetchIndexData = function (range, opType, nullDisallowed, unboundedAllowed) {
    var me = this;
    var hasUnboundedRange = unboundedAllowed && range == null;

    if (this.__deleted) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'This index has been deleted');
    }
    if (this.objectStore.__deleted) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', "This index's object store has been deleted");
    }
    IDBTransaction.__assertActive(this.objectStore.transaction);

    if (nullDisallowed && !unboundedAllowed && range == null) {
        throw (0, _DOMException.createDOMException)('DataError', 'No key or range was specified');
    }

    var fetchArgs = fetchIndexData(me, !hasUnboundedRange, range, opType, false);
    return me.objectStore.transaction.__addToTransactionQueue(function () {
        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
        }

        executeFetchIndexData.apply(undefined, _toConsumableArray(fetchArgs).concat(args));
    }, undefined, me);
};

/**
 * Opens a cursor over the given key range.
 * @param {IDBKeyRange} range
 * @param {string} direction
 * @returns {IDBRequest}
 */
IDBIndex.prototype.openCursor = function (range, direction) {
    var cursor = new _IDBCursor.IDBCursorWithValue(range, direction, this.objectStore, this, util.escapeIndexName(this.name), 'value');
    this.__objectStore.__cursors.push(cursor);
    return cursor.__req;
};

/**
 * Opens a cursor over the given key range.  The cursor only includes key values, not data.
 * @param {IDBKeyRange} range
 * @param {string} direction
 * @returns {IDBRequest}
 */
IDBIndex.prototype.openKeyCursor = function (range, direction) {
    var cursor = new _IDBCursor.IDBCursor(range, direction, this.objectStore, this, util.escapeIndexName(this.name), 'key');
    this.__objectStore.__cursors.push(cursor);
    return cursor.__req;
};

IDBIndex.prototype.get = function (query) {
    if (!arguments.length) {
        // Per https://heycam.github.io/webidl/
        throw new TypeError('A parameter was missing for `IDBIndex.get`.');
    }
    return this.__fetchIndexData(query, 'value', true);
};

IDBIndex.prototype.getKey = function (query) {
    if (!arguments.length) {
        // Per https://heycam.github.io/webidl/
        throw new TypeError('A parameter was missing for `IDBIndex.getKey`.');
    }
    return this.__fetchIndexData(query, 'key', true);
};

/*
// Todo: Implement getAll
IDBIndex.prototype.getAll = function (query, count) {
};
*/

/*
// Todo: Implement getAllKeys
IDBIndex.prototype.getAllKeys = function (query, count) {
};
*/

IDBIndex.prototype.count = function (query) {
    // key is optional
    if (util.instanceOf(query, _IDBKeyRange.IDBKeyRange)) {
        if (!query.toString() !== '[object IDBKeyRange]') {
            query = new _IDBKeyRange.IDBKeyRange(query.lower, query.upper, query.lowerOpen, query.upperOpen);
        }
        // We don't need to add to cursors array since has the count parameter which won't cache
        return new _IDBCursor.IDBCursorWithValue(query, 'next', this.objectStore, this, util.escapeIndexName(this.name), 'value', true).__req;
    }
    return this.__fetchIndexData(query, 'count', false, true);
};

IDBIndex.prototype.__renameIndex = function (storeName, oldName, newName) {
    var colInfoToPreserveArr = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];

    var newNameType = 'BLOB';
    var colNamesToPreserve = colInfoToPreserveArr.map(function (colInfo) {
        return colInfo[0];
    });
    var colInfoToPreserve = colInfoToPreserveArr.map(function (colInfo) {
        return colInfo.join(' ');
    });
    var listColInfoToPreserve = colInfoToPreserve.length ? colInfoToPreserve.join(', ') + ', ' : '';
    var listColsToPreserve = colNamesToPreserve.length ? colNamesToPreserve.join(', ') + ', ' : '';

    var me = this;
    // We could adapt the approach at http://stackoverflow.com/a/8430746/271577
    //    to make the approach reusable without passing column names, but it is a bit fragile
    me.transaction.__addNonRequestToTransactionQueue(function renameIndex(tx, args, success, error) {
        var sql = 'ALTER TABLE ' + util.escapeStore(storeName) + ' RENAME TO tmp_' + util.escapeStore(storeName);
        tx.executeSql(sql, [], function (tx, data) {
            var sql = 'CREATE TABLE ' + util.escapeStore(storeName) + '(' + listColInfoToPreserve + util.escapeIndex(newName) + ' ' + newNameType + ')';
            tx.executeSql(sql, [], function (tx, data) {
                var sql = 'INSERT INTO ' + util.escapeStore(storeName) + '(' + listColsToPreserve + util.escapeIndex(newName) + ') SELECT ' + listColsToPreserve + util.escapeIndex(oldName) + ' FROM tmp_' + util.escapeStore(storeName);
                tx.executeSql(sql, [], function (tx, data) {
                    var sql = 'DROP TABLE tmp_' + util.escapeStore(storeName);
                    tx.executeSql(sql, [], function (tx, data) {
                        success();
                    }, function (tx, err) {
                        error(err);
                    });
                }, function (tx, err) {
                    error(err);
                });
            });
        }, function (tx, err) {
            error(err);
        });
    });
};

IDBIndex.prototype.toString = function () {
    return '[object IDBIndex]';
};

util.defineReadonlyProperties(IDBIndex.prototype, ['objectStore', 'keyPath', 'multiEntry', 'unique']);

Object.defineProperty(IDBIndex, Symbol.hasInstance, {
    value: function value(obj) {
        return util.isObj(obj) && typeof obj.openCursor === 'function' && typeof obj.multiEntry === 'boolean';
    }
});

Object.defineProperty(IDBIndex.prototype, 'name', {
    enumerable: false,
    configurable: false,
    get: function get() {
        return this.__name;
    },
    set: function set(newName) {
        var me = this;
        var oldName = me.name;
        IDBTransaction.__assertVersionChange(this.objectStore.transaction);
        IDBTransaction.__assertActive(this.objectStore.transaction);
        if (me.__deleted) {
            throw (0, _DOMException.createDOMException)('InvalidStateError', 'This index has been deleted');
        }
        if (me.objectStore.__deleted) {
            throw (0, _DOMException.createDOMException)('InvalidStateError', "This index's object store has been deleted");
        }
        if (newName === oldName) {
            return;
        }
        if (me.objectStore.__indexes[newName] && !me.objectStore.__indexes[newName].__deleted) {
            throw (0, _DOMException.createDOMException)('ConstraintError', 'Index "' + newName + '" already exists on ' + me.objectStore.name);
        }

        me.__name = newName;
        // Todo: Add pending flag to delay queries against this index until renamed in SQLite
        var colInfoToPreserveArr = [['key', 'BLOB ' + (me.objectStore.autoIncrement ? 'UNIQUE, inc INTEGER PRIMARY KEY AUTOINCREMENT' : 'PRIMARY KEY')], ['value', 'BLOB']];
        this.__renameIndex(me.objectStore.name, oldName, newName, colInfoToPreserveArr);
    }
});

function executeFetchIndexData(index, hasKey, encodedKey, opType, multiChecks, sql, sqlValues, tx, args, success, error) {
    tx.executeSql(sql.join(' '), sqlValues, function (tx, data) {
        var recordCount = 0,
            record = null;
        if (index.multiEntry) {
            var _loop = function _loop(i) {
                var row = data.rows.item(i);
                var rowKey = _Key2.default.decode(row[util.escapeIndexName(index.name)]);
                if (hasKey && (multiChecks && encodedKey.some(function (check) {
                    return rowKey.includes(check);
                }) || // More precise than our SQL
                _Key2.default.isMultiEntryMatch(encodedKey, row[util.escapeIndexName(index.name)]))) {
                    recordCount++;
                    record = record || row;
                } else if (!hasKey && !multiChecks) {
                    if (rowKey !== undefined) {
                        recordCount = recordCount + (Array.isArray(rowKey) ? rowKey.length : 1);
                        record = record || row;
                    }
                }
            };

            for (var i = 0; i < data.rows.length; i++) {
                _loop(i);
            }
        } else {
            recordCount = data.rows.length;
            record = recordCount && data.rows.item(0);
        }
        if (opType === 'count') {
            success(recordCount);
        } else if (recordCount === 0) {
            success(undefined);
        } else if (opType === 'key') {
            success(_Key2.default.decode(record.key));
        } else {
            // when opType is value
            success(_Sca2.default.decode(record.value));
        }
    }, error);
}

function fetchIndexData(index, hasRange, range, opType, multiChecks) {
    var sql = ['SELECT * FROM', util.escapeStore(index.objectStore.name), 'WHERE', util.escapeIndex(index.name), 'NOT NULL'];
    var sqlValues = [];
    if (hasRange) {
        if (multiChecks) {
            sql.push('AND (');
            range.forEach(function (innerKey, i) {
                if (i > 0) sql.push('OR');
                sql.push(util.escapeIndex(index.name), "LIKE ? ESCAPE '^' ");
                sqlValues.push('%' + util.sqlLIKEEscape(_Key2.default.encode(innerKey, index.multiEntry)) + '%');
            });
            sql.push(')');
        } else if (index.multiEntry) {
            sql.push('AND', util.escapeIndex(index.name), "LIKE ? ESCAPE '^'");
            range = _Key2.default.encode(range, index.multiEntry);
            sqlValues.push('%' + util.sqlLIKEEscape(range) + '%');
        } else {
            if (util.instanceOf(range, _IDBKeyRange.IDBKeyRange)) {
                // We still need to validate IDBKeyRange-like objects (the above check is based on duck-typing)
                if (!range.toString() !== '[object IDBKeyRange]') {
                    range = new _IDBKeyRange.IDBKeyRange(range.lower, range.upper, range.lowerOpen, range.upperOpen);
                }
            } else {
                range = _IDBKeyRange.IDBKeyRange.only(range);
            }
            (0, _IDBKeyRange.setSQLForRange)(range, util.escapeIndex(index.name), sql, sqlValues, true, false);
        }
    }
    _CFG2.default.DEBUG && console.log('Trying to fetch data for Index', sql.join(' '), sqlValues);
    return [index, hasRange, range, opType, multiChecks, sql, sqlValues];
}

exports.fetchIndexData = fetchIndexData;
exports.executeFetchIndexData = executeFetchIndexData;
exports.IDBIndex = IDBIndex;
exports.default = IDBIndex;