'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.IDBCursorWithValue = exports.IDBCursor = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _IDBRequest = require('./IDBRequest.js');

var _DOMException = require('./DOMException.js');

var _IDBKeyRange = require('./IDBKeyRange.js');

var _IDBFactory = require('./IDBFactory.js');

var _util = require('./util.js');

var util = _interopRequireWildcard(_util);

var _IDBTransaction = require('./IDBTransaction.js');

var _IDBTransaction2 = _interopRequireDefault(_IDBTransaction);

var _Key = require('./Key.js');

var _Key2 = _interopRequireDefault(_Key);

var _Sca = require('./Sca.js');

var _Sca2 = _interopRequireDefault(_Sca);

var _IDBIndex = require('./IDBIndex.js');

var _IDBIndex2 = _interopRequireDefault(_IDBIndex);

var _CFG = require('./CFG.js');

var _CFG2 = _interopRequireDefault(_CFG);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The IndexedDB Cursor Object
 * http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#idl-def-IDBCursor
 * @param {IDBKeyRange} range
 * @param {string} direction
 * @param {IDBObjectStore} store
 * @param {IDBObjectStore|IDBIndex} source
 * @param {string} keyColumnName
 * @param {string} valueColumnName
 * @param {boolean} count
 */
function IDBCursor(range, direction, store, source, keyColumnName, valueColumnName, count) {
    // Calling openCursor on an index or objectstore with null is allowed but we treat it as undefined internally
    _IDBTransaction2.default.__assertActive(store.transaction);
    if (range === null) {
        range = undefined;
    }
    if (util.instanceOf(range, _IDBKeyRange.IDBKeyRange)) {
        // We still need to validate IDBKeyRange-like objects (the above check is based on duck-typing)
        if (!range.toString() !== '[object IDBKeyRange]') {
            range = new _IDBKeyRange.IDBKeyRange(range.lower, range.upper, range.lowerOpen, range.upperOpen);
        }
    } else if (range !== undefined) {
        range = new _IDBKeyRange.IDBKeyRange(range, range, false, false);
    }
    if (direction !== undefined && !['next', 'prev', 'nextunique', 'prevunique'].includes(direction)) {
        throw new TypeError(direction + 'is not a valid cursor direction');
    }

    Object.defineProperties(this, {
        // Babel is not respecting default writable false here, so make explicit
        source: { writable: false, value: source },
        direction: { writable: false, value: direction || 'next' }
    });
    this.__key = undefined;
    this.__primaryKey = undefined;

    this.__store = store;
    this.__range = range;
    this.__req = new _IDBRequest.IDBRequest();
    this.__req.__source = source;
    this.__req.__transaction = this.__store.transaction;
    this.__keyColumnName = keyColumnName;
    this.__valueColumnName = valueColumnName;
    this.__keyOnly = valueColumnName === 'key';
    this.__valueDecoder = this.__keyOnly ? _Key2.default : _Sca2.default;
    this.__count = count;
    this.__prefetchedIndex = -1;
    this.__indexSource = util.instanceOf(source, _IDBIndex2.default);
    this.__multiEntryIndex = this.__indexSource ? source.multiEntry : false;
    this.__unique = this.direction.includes('unique');
    this.__sqlDirection = ['prev', 'prevunique'].includes(this.direction) ? 'DESC' : 'ASC';

    if (range !== undefined) {
        // Encode the key range and cache the encoded values, so we don't have to re-encode them over and over
        range.__lowerCached = range.lower !== undefined && _Key2.default.encode(range.lower, this.__multiEntryIndex);
        range.__upperCached = range.upper !== undefined && _Key2.default.encode(range.upper, this.__multiEntryIndex);
    }
    this.__gotValue = true;
    this['continue']();
}

IDBCursor.prototype.__find = function () /* key, tx, success, error, recordsToLoad */{
    if (this.__multiEntryIndex) {
        this.__findMultiEntry.apply(this, arguments);
    } else {
        this.__findBasic.apply(this, arguments);
    }
};

IDBCursor.prototype.__findBasic = function (key, tx, success, error, recordsToLoad) {
    var continueCall = recordsToLoad !== undefined;
    recordsToLoad = recordsToLoad || 1;

    var me = this;
    var quotedKeyColumnName = util.quote(me.__keyColumnName);
    var sql = ['SELECT * FROM', util.escapeStore(me.__store.name)];
    var sqlValues = [];
    sql.push('WHERE', quotedKeyColumnName, 'NOT NULL');
    (0, _IDBKeyRange.setSQLForRange)(me.__range, quotedKeyColumnName, sql, sqlValues, true, true);

    // Determine the ORDER BY direction based on the cursor.
    var direction = me.__sqlDirection;
    var op = direction === 'ASC' ? '>' : '<';

    if (key !== undefined) {
        sql.push('AND', quotedKeyColumnName, op + '= ?');
        _Key2.default.convertValueToKey(key);
        sqlValues.push(_Key2.default.encode(key));
    } else if (continueCall && me.__key !== undefined) {
        sql.push('AND', quotedKeyColumnName, op + ' ?');
        _Key2.default.convertValueToKey(me.__key);
        sqlValues.push(_Key2.default.encode(me.__key));
    }

    if (!me.__count) {
        // 1. Sort by key
        sql.push('ORDER BY', quotedKeyColumnName, direction); // Todo: Any reason for this first sorting?

        // 2. Sort by primaryKey (if defined and not unique)
        if (!me.__unique && me.__keyColumnName !== 'key') {
            // Avoid adding 'key' twice
            sql.push(',', util.quote('key'), direction);
        }

        // 3. Sort by position (if defined)

        if (!me.__unique && me.__indexSource) {
            // 4. Sort by object store position (if defined and not unique)
            sql.push(',', util.quote(me.__valueColumnName), direction);
        }
        sql.push('LIMIT', recordsToLoad);
    }
    sql = sql.join(' ');
    _CFG2.default.DEBUG && console.log(sql, sqlValues);

    tx.executeSql(sql, sqlValues, function (tx, data) {
        if (me.__count) {
            success(undefined, data.rows.length, undefined);
        } else if (data.rows.length > 1) {
            me.__prefetchedIndex = 0;
            me.__prefetchedData = data.rows;
            _CFG2.default.DEBUG && console.log('Preloaded ' + me.__prefetchedData.length + ' records for cursor');
            me.__decode(data.rows.item(0), success);
        } else if (data.rows.length === 1) {
            me.__decode(data.rows.item(0), success);
        } else {
            _CFG2.default.DEBUG && console.log('Reached end of cursors');
            success(undefined, undefined, undefined);
        }
    }, function (tx, err) {
        _CFG2.default.DEBUG && console.log('Could not execute Cursor.continue', sql, sqlValues);
        error(err);
    });
};

IDBCursor.prototype.__findMultiEntry = function (key, tx, success, error) {
    var me = this;

    if (me.__prefetchedData && me.__prefetchedData.length === me.__prefetchedIndex) {
        _CFG2.default.DEBUG && console.log('Reached end of multiEntry cursor');
        success(undefined, undefined, undefined);
        return;
    }

    var quotedKeyColumnName = util.quote(me.__keyColumnName);
    var sql = ['SELECT * FROM', util.escapeStore(me.__store.name)];
    var sqlValues = [];
    sql.push('WHERE', quotedKeyColumnName, 'NOT NULL');
    if (me.__range && me.__range.lower !== undefined && Array.isArray(me.__range.upper)) {
        if (me.__range.upper.indexOf(me.__range.lower) === 0) {
            sql.push('AND', quotedKeyColumnName, "LIKE ? ESCAPE '^'");
            sqlValues.push('%' + util.sqlLIKEEscape(me.__range.__lowerCached.slice(0, -1)) + '%');
        }
    }

    // Determine the ORDER BY direction based on the cursor.
    var direction = me.__sqlDirection;
    var op = direction === 'ASC' ? '>' : '<';

    if (key !== undefined) {
        sql.push('AND', quotedKeyColumnName, op + '= ?');
        _Key2.default.convertValueToKey(key);
        sqlValues.push(_Key2.default.encode(key));
    } else if (me.__key !== undefined) {
        sql.push('AND', quotedKeyColumnName, op + ' ?');
        _Key2.default.convertValueToKey(me.__key);
        sqlValues.push(_Key2.default.encode(me.__key));
    }

    if (!me.__count) {
        // 1. Sort by key
        sql.push('ORDER BY', quotedKeyColumnName, direction); // Todo: Any reason for this first sorting?

        // 2. Sort by primaryKey (if defined and not unique)
        if (!me.__unique && me.__keyColumnName !== 'key') {
            // Avoid adding 'key' twice
            sql.push(',', util.quote('key'), direction);
        }

        // 3. Sort by position (if defined)

        if (!me.__unique && me.__indexSource) {
            // 4. Sort by object store position (if defined and not unique)
            sql.push(',', util.quote(me.__valueColumnName), direction);
        }
    }
    sql = sql.join(' ');
    _CFG2.default.DEBUG && console.log(sql, sqlValues);

    tx.executeSql(sql, sqlValues, function (tx, data) {
        if (data.rows.length > 0) {
            var _ret = function () {
                if (me.__count) {
                    // Avoid caching and other processing below
                    var ct = 0;
                    for (var i = 0; i < data.rows.length; i++) {
                        var rowItem = data.rows.item(i);
                        var rowKey = _Key2.default.decode(rowItem[me.__keyColumnName], true);
                        var matches = _Key2.default.findMultiEntryMatches(rowKey, me.__range);
                        ct += matches.length;
                    }
                    success(undefined, ct, undefined);
                    return {
                        v: void 0
                    };
                }
                var rows = [];
                for (var _i = 0; _i < data.rows.length; _i++) {
                    var _rowItem = data.rows.item(_i);
                    var _rowKey = _Key2.default.decode(_rowItem[me.__keyColumnName], true);
                    var _matches = _Key2.default.findMultiEntryMatches(_rowKey, me.__range);

                    for (var j = 0; j < _matches.length; j++) {
                        var matchingKey = _matches[j];
                        var clone = {
                            matchingKey: _Key2.default.encode(matchingKey, true),
                            key: _rowItem.key
                        };
                        clone[me.__keyColumnName] = _rowItem[me.__keyColumnName];
                        clone[me.__valueColumnName] = _rowItem[me.__valueColumnName];
                        rows.push(clone);
                    }
                }
                var reverse = me.direction.indexOf('prev') === 0;
                rows.sort(function (a, b) {
                    if (a.matchingKey.replace('[', 'z') < b.matchingKey.replace('[', 'z')) {
                        return reverse ? 1 : -1;
                    }
                    if (a.matchingKey.replace('[', 'z') > b.matchingKey.replace('[', 'z')) {
                        return reverse ? -1 : 1;
                    }
                    if (a.key < b.key) {
                        return me.direction === 'prev' ? 1 : -1;
                    }
                    if (a.key > b.key) {
                        return me.direction === 'prev' ? -1 : 1;
                    }
                    return 0;
                });

                if (rows.length > 1) {
                    me.__prefetchedIndex = 0;
                    me.__prefetchedData = {
                        data: rows,
                        length: rows.length,
                        item: function item(index) {
                            return this.data[index];
                        }
                    };
                    _CFG2.default.DEBUG && console.log('Preloaded ' + me.__prefetchedData.length + ' records for multiEntry cursor');
                    me.__decode(rows[0], success);
                } else if (rows.length === 1) {
                    _CFG2.default.DEBUG && console.log('Reached end of multiEntry cursor');
                    me.__decode(rows[0], success);
                } else {
                    _CFG2.default.DEBUG && console.log('Reached end of multiEntry cursor');
                    success(undefined, undefined, undefined);
                }
            }();

            if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
        } else {
            _CFG2.default.DEBUG && console.log('Reached end of multiEntry cursor');
            success(undefined, undefined, undefined);
        }
    }, function (tx, err) {
        _CFG2.default.DEBUG && console.log('Could not execute Cursor.continue', sql, sqlValues);
        error(err);
    });
};

/**
 * Creates an "onsuccess" callback
 * @private
 */
IDBCursor.prototype.__onsuccess = function (success) {
    var me = this;
    return function (key, value, primaryKey) {
        me.__gotValue = true;
        if (me.__count) {
            success(value, me.__req);
        } else {
            me.__key = key === undefined ? null : key;
            me.__primaryKey = primaryKey === undefined ? null : primaryKey;
            me.__value = value === undefined ? null : value;
            var result = key === undefined ? null : me;
            success(result, me.__req);
        }
    };
};

IDBCursor.prototype.__decode = function (rowItem, callback) {
    if (this.__multiEntryIndex && this.__unique) {
        if (!this.__matchedKeys) {
            this.__matchedKeys = {};
        }
        if (this.__matchedKeys[rowItem.matchingKey]) {
            callback(undefined, undefined, undefined);
            return;
        }
        this.__matchedKeys[rowItem.matchingKey] = true;
    }
    var key = _Key2.default.decode(this.__multiEntryIndex ? rowItem.matchingKey : rowItem[this.__keyColumnName], this.__multiEntryIndex);
    var val = this.__valueDecoder.decode(rowItem[this.__valueColumnName]);
    var primaryKey = _Key2.default.decode(rowItem.key);
    callback(key, val, primaryKey);
};

IDBCursor.prototype.__sourceOrEffectiveObjStoreDeleted = function () {
    if (!this.__store.transaction.db.objectStoreNames.contains(this.__store.name) || this.__indexSource && !this.__store.indexNames.contains(this.source.name)) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'The cursor\'s source or effective object store has been deleted');
    }
};

IDBCursor.prototype.__addToCache = function () {
    this.__prefetchedData = null;
};

IDBCursor.prototype.__deleteFromCache = function (sql, sqlValues) {
    this.__prefetchedData = null;
};

IDBCursor.prototype.__clearFromCache = function () {
    this.__prefetchedData = null;
};

IDBCursor.prototype.__continue = function (key, advanceContinue) {
    var me = this;
    var recordsToPreloadOnContinue = me.__advanceCount || _CFG2.default.cursorPreloadPackSize || 100;
    var advanceState = me.__advanceCount !== undefined;
    _IDBTransaction2.default.__assertActive(me.__store.transaction);
    me.__sourceOrEffectiveObjStoreDeleted();
    if (!me.__gotValue && !advanceContinue) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'The cursor is being iterated or has iterated past its end.');
    }
    if (key !== undefined) _Key2.default.convertValueToKey(key);

    if (key !== undefined) {
        var cmpResult = (0, _IDBFactory.cmp)(key, me.key);
        if (cmpResult === 0 || me.direction.includes('next') && cmpResult === -1 || me.direction.includes('prev') && cmpResult === 1) {
            throw (0, _DOMException.createDOMException)('DataError', 'Cannot ' + (advanceState ? 'advance' : 'continue') + ' the cursor in an unexpected direction');
        }
    }

    me.__gotValue = false;
    me.__req.__readyState = 'pending'; // Unset done flag

    me.__store.transaction.__pushToQueue(me.__req, function cursorContinue(tx, args, success, error, executeNextRequest) {
        function triggerSuccess(k, val, primKey) {
            if (advanceState) {
                if (me.__advanceCount >= 2 && k !== undefined) {
                    me.__advanceCount--;
                    me.__key = k;
                    me.__continue(undefined, true);
                    executeNextRequest(); // We don't call success yet but do need to advance the transaction queue
                    return;
                }
                me.__advanceCount = undefined;
            }
            me.__onsuccess(success)(k, val, primKey);
        }
        if (me.__prefetchedData) {
            // We have pre-loaded data for the cursor
            me.__prefetchedIndex++;
            if (me.__prefetchedIndex < me.__prefetchedData.length) {
                me.__decode(me.__prefetchedData.item(me.__prefetchedIndex), function (k, val, primKey) {
                    function checkKey() {
                        if (key !== undefined && k !== key) {
                            cursorContinue(tx, args, success, error);
                            return;
                        }
                        triggerSuccess(k, val, primKey);
                    }
                    if (me.__unique && !me.__multiEntryIndex) {
                        _Sca2.default.encode(val, function (encVal) {
                            _Sca2.default.encode(me.value, function (encMeVal) {
                                if (encVal === encMeVal) {
                                    cursorContinue(tx, args, success, error);
                                    return;
                                }
                                checkKey();
                            });
                        });
                        return;
                    }
                    checkKey();
                });
                return;
            }
        }

        // No (or not enough) pre-fetched data, do query
        me.__find(key, tx, triggerSuccess, function () {
            me.__advanceCount = undefined;
            error.apply(undefined, arguments);
        }, recordsToPreloadOnContinue);
    });
};

IDBCursor.prototype['continue'] = function (key) {
    this.__continue(key);
};

/*
// Todo: Implement continuePrimaryKey
IDBCursor.prototype.continuePrimaryKey = function (key, primaryKey) {};
*/

IDBCursor.prototype.advance = function (count) {
    var me = this;
    if (!Number.isFinite(count) || count <= 0) {
        throw new TypeError('Count is invalid - 0 or negative: ' + count);
    }
    if (me.__gotValue) {
        // Only set the count if not running in error (otherwise will override earlier good advance calls)
        me.__advanceCount = count;
    }
    me.__continue();
};

IDBCursor.prototype.update = function (valueToUpdate) {
    var me = this;
    if (!arguments.length) throw new TypeError('A value must be passed to update()');
    _IDBTransaction2.default.__assertActive(me.__store.transaction);
    me.__store.transaction.__assertWritable();
    me.__sourceOrEffectiveObjStoreDeleted();
    if (!me.__gotValue) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'The cursor is being iterated or has iterated past its end.');
    }
    if (me.__keyOnly) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'This cursor method cannot be called when the key only flag has been set.');
    }
    util.throwIfNotClonable(valueToUpdate, 'The data to be updated could not be cloned by the internal structured cloning algorithm.');
    if (me.__store.keyPath !== null) {
        var evaluatedKey = me.__store.__validateKeyAndValue(valueToUpdate);
        if (me.primaryKey !== evaluatedKey) {
            throw (0, _DOMException.createDOMException)('DataError', 'The key of the supplied value to `update` is not equal to the cursor\'s effective key');
        }
    }
    return me.__store.transaction.__addToTransactionQueue(function cursorUpdate(tx, args, success, error) {
        var key = me.key;
        var primaryKey = me.primaryKey;
        var store = me.__store;
        _Sca2.default.encode(valueToUpdate, function (encoded) {
            var value = _Sca2.default.decode(encoded);
            _Sca2.default.encode(value, function (encoded) {
                // First try to delete if the record exists
                _Key2.default.convertValueToKey(primaryKey);
                var sql = 'DELETE FROM ' + util.escapeStore(store.name) + ' WHERE key = ?';
                var encodedPrimaryKey = _Key2.default.encode(primaryKey);
                _CFG2.default.DEBUG && console.log(sql, encoded, key, primaryKey, encodedPrimaryKey);

                tx.executeSql(sql, [encodedPrimaryKey], function (tx, data) {
                    _CFG2.default.DEBUG && console.log('Did the row with the', primaryKey, 'exist? ', data.rowsAffected);

                    store.__deriveKey(tx, value, key, function (primaryKey, useNewForAutoInc) {
                        store.__insertData(tx, encoded, value, primaryKey, key, useNewForAutoInc, function () {
                            store.__cursors.forEach(function (cursor) {
                                cursor.__deleteFromCache();
                                cursor.__addToCache();
                            });
                            success.apply(undefined, arguments);
                        }, error);
                    }, function (tx, err) {
                        error(err);
                    });
                });
            });
        });
    }, undefined, me);
};

IDBCursor.prototype['delete'] = function () {
    var me = this;
    _IDBTransaction2.default.__assertActive(me.__store.transaction);
    me.__store.transaction.__assertWritable();
    me.__sourceOrEffectiveObjStoreDeleted();
    if (!me.__gotValue) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'The cursor is being iterated or has iterated past its end.');
    }
    if (me.__keyOnly) {
        throw (0, _DOMException.createDOMException)('InvalidStateError', 'This cursor method cannot be called when the key only flag has been set.');
    }
    return this.__store.transaction.__addToTransactionQueue(function cursorDelete(tx, args, success, error) {
        me.__find(undefined, tx, function (key, value, primaryKey) {
            var sql = 'DELETE FROM  ' + util.escapeStore(me.__store.name) + ' WHERE key = ?';
            _CFG2.default.DEBUG && console.log(sql, key, primaryKey);
            _Key2.default.convertValueToKey(primaryKey);
            tx.executeSql(sql, [_Key2.default.encode(primaryKey)], function (tx, data) {
                if (data.rowsAffected === 1) {
                    me.__store.__cursors.forEach(function (cursor) {
                        cursor.__deleteFromCache();
                    });
                    success(undefined);
                } else {
                    error('No rows with key found' + key);
                }
            }, function (tx, data) {
                error(data);
            });
        }, error);
    }, undefined, me);
};

IDBCursor.prototype.toString = function () {
    return '[object IDBCursor]';
};

util.defineReadonlyProperties(IDBCursor.prototype, ['key', 'primaryKey']);

var IDBCursorWithValue = function (_IDBCursor) {
    _inherits(IDBCursorWithValue, _IDBCursor);

    function IDBCursorWithValue() {
        _classCallCheck(this, IDBCursorWithValue);

        return _possibleConstructorReturn(this, (IDBCursorWithValue.__proto__ || Object.getPrototypeOf(IDBCursorWithValue)).apply(this, arguments));
    }

    _createClass(IDBCursorWithValue, [{
        key: 'toString',
        value: function toString() {
            return '[object IDBCursorWithValue]';
        }
    }]);

    return IDBCursorWithValue;
}(IDBCursor);

util.defineReadonlyProperties(IDBCursorWithValue.prototype, 'value');

exports.IDBCursor = IDBCursor;
exports.IDBCursorWithValue = IDBCursorWithValue;