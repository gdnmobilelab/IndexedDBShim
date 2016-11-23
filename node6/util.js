'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.isValidKeyPath = exports.defineReadonlyProperties = exports.throwIfNotClonable = exports.isFile = exports.isRegExp = exports.isBlob = exports.isDate = exports.isObj = exports.instanceOf = exports.sqlLIKEEscape = exports.escapeIndexName = exports.escapeIndex = exports.escapeStore = exports.escapeDatabaseName = exports.quote = exports.StringList = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _DOMException = require('./DOMException.js');

var _CFG = require('./CFG.js');

var _CFG2 = _interopRequireDefault(_CFG);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var cleanInterface = false;

var testObject = { test: true };
// Test whether Object.defineProperty really works.
if (Object.defineProperty) {
    try {
        Object.defineProperty(testObject, 'test', { enumerable: false });
        if (testObject.test) {
            cleanInterface = true;
        }
    } catch (e) {
        // Object.defineProperty does not work as intended.
    }
}

/**
 * Shim the DOMStringList object.
 *
 */
var StringList = function StringList() {
    this.length = 0;
    this._items = [];
    // Internal functions on the prototype have been made non-enumerable below.
    if (cleanInterface) {
        Object.defineProperties(this, {
            '_items': {
                enumerable: false
            },
            'length': {
                enumerable: false
            }
        });
    }
};
StringList.prototype = {
    // Interface.
    contains: function contains(str) {
        return this._items.includes(str);
    },
    item: function item(key) {
        return this._items[key];
    },

    // Helpers. Should only be used internally.
    addIndexes: function addIndexes() {
        for (var i = 0; i < this._items.length; i++) {
            this[i] = this._items[i];
        }
    },
    sortList: function sortList() {
        // http://w3c.github.io/IndexedDB/#sorted-list
        // https://tc39.github.io/ecma262/#sec-abstract-relational-comparison
        this._items.sort();
        this.addIndexes();
        return this._items;
    },
    forEach: function forEach(cb, thisArg) {
        this._items.forEach(cb, thisArg);
    },
    map: function map(cb, thisArg) {
        return this._items.map(cb, thisArg);
    },
    indexOf: function indexOf(str) {
        return this._items.indexOf(str);
    },
    push: function push(item) {
        this._items.push(item);
        this.length++;
        this.sortList();
    },
    splice: function splice() /* index, howmany, item1, ..., itemX */{
        var _items;

        (_items = this._items).splice.apply(_items, arguments);
        this.length = this._items.length;
        for (var i in this) {
            if (i === String(parseInt(i, 10))) {
                delete this[i];
            }
        }
        this.sortList();
    }
};
if (cleanInterface) {
    for (var i in {
        'addIndexes': false,
        'sortList': false,
        'forEach': false,
        'map': false,
        'indexOf': false,
        'push': false,
        'splice': false
    }) {
        Object.defineProperty(StringList.prototype, i, {
            enumerable: false
        });
    }
}

function escapeNULAndCasing(arg) {
    // http://stackoverflow.com/a/6701665/271577
    return arg.replace(/\^/g, '^^').replace(/\x00/g, '^0') // eslint-disable-line no-control-regex
    // We need to avoid tables being treated as duplicates based on SQLite's case-insensitive table and column names
    // http://stackoverflow.com/a/17215009/271577
    // See also https://www.sqlite.org/faq.html#q18 re: Unicode case-insensitive not working
    .replace(/([A-Z])/g, '^$1');
}

function sqlEscape(arg) {
    // https://www.sqlite.org/lang_keywords.html
    // http://stackoverflow.com/a/6701665/271577
    // There is no need to escape ', `, or [], as
    //   we should always be within double quotes
    // NUL should have already been stripped
    return arg.replace(/"/g, '""');
}

function quote(arg) {
    return '"' + sqlEscape(arg) + '"';
}

function escapeDatabaseName(db) {
    return 'D_' + escapeNULAndCasing(db); // Shouldn't have quoting (do we even need NUL/case escaping here?)
}

function escapeStore(store) {
    return quote('s_' + escapeNULAndCasing(store));
}

function escapeIndex(index) {
    return quote('_' + escapeNULAndCasing(index));
}

function escapeIndexName(index) {
    return '_' + escapeNULAndCasing(index);
}

function sqlLIKEEscape(str) {
    // https://www.sqlite.org/lang_expr.html#like
    return sqlEscape(str).replace(/\^/g, '^^');
}

// Babel doesn't seem to provide a means of using the `instanceof` operator with Symbol.hasInstance (yet?)
function instanceOf(obj, Clss) {
    return Clss[Symbol.hasInstance](obj);
}

function isObj(obj) {
    return obj && (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object';
}

function isDate(obj) {
    return isObj(obj) && typeof obj.getDate === 'function';
}

function isBlob(obj) {
    return isObj(obj) && typeof obj.size === 'number' && typeof obj.slice === 'function';
}

function isRegExp(obj) {
    return isObj(obj) && typeof obj.flags === 'string' && typeof obj.exec === 'function';
}

function isFile(obj) {
    return isObj(obj) && typeof obj.name === 'string' && isBlob(obj);
}

/*
// Todo: Uncomment and use with ArrayBuffer encoding/decoding when ready
function isArrayBufferOrView (obj) {
    return isObj(obj) && typeof obj.byteLength === 'number' && (
        typeof obj.slice === 'function' || // `TypedArray` (view on buffer) or `ArrayBuffer`
        typeof obj.getFloat64 === 'function' // `DataView` (view on buffer)
    );
}
*/

function isNotClonable(value) {
    return ['function', 'symbol'].includes(typeof value === 'undefined' ? 'undefined' : _typeof(value)) || isObj(value) && (value instanceof Error || // Duck-typing with some util.isError would be better, but too easy to get a false match
    value.nodeType > 0 && typeof value.nodeName === 'string' // DOM nodes
    );
}

function throwIfNotClonable(value, errMsg) {
    JSON.stringify(value, function (key, val) {
        if (isNotClonable(val)) {
            throw (0, _DOMException.createDOMException)('DataCloneError', errMsg);
        }
        return val;
    });
}

function defineReadonlyProperties(obj, props) {
    props = typeof props === 'string' ? [props] : props;
    props.forEach(function (prop) {
        Object.defineProperty(obj, '__' + prop, {
            enumerable: false,
            configurable: false,
            writable: true
        });
        Object.defineProperty(obj, prop, {
            enumerable: true,
            configurable: true,
            get: function get() {
                return this['__' + prop];
            }
        });
    });
}

var HexDigit = '[0-9a-fA-F]';
// The commented out line below is technically the grammar, with a SyntaxError
//   to occur if larger than U+10FFFF, but we will prevent the error by
//   establishing the limit in regular expressions
// const HexDigits = HexDigit + HexDigit + '*';
var HexDigits = '0*(?:' + HexDigit + '{1,5}|10' + HexDigit + '{4})*';
var UnicodeEscapeSequence = '(?:u' + HexDigit + '{4}|u{' + HexDigits + '})';

function isIdentifier(item) {
    // For load-time and run-time performance, we don't provide the complete regular
    //   expression for identifiers, but these can be passed in, using the expressions
    //   found at https://gist.github.com/brettz9/b4cd6821d990daa023b2e604de371407
    // ID_Start (includes Other_ID_Start)
    var UnicodeIDStart = _CFG2.default.UnicodeIDStart || '[$A-Z_a-z]';
    // ID_Continue (includes Other_ID_Continue)
    var UnicodeIDContinue = _CFG2.default.UnicodeIDContinue || '[$0-9A-Z_a-z]';
    var IdentifierStart = '(?:' + UnicodeIDStart + '|[$_]|\\\\' + UnicodeEscapeSequence + ')';
    var IdentifierPart = '(?:' + UnicodeIDContinue + '|[$_]|\\\\' + UnicodeEscapeSequence + '|\\u200C|\\u200D)';
    return new RegExp('^' + IdentifierStart + IdentifierPart + '*$').test(item);
}

function isValidKeyPathString(keyPathString) {
    return typeof keyPathString === 'string' && (keyPathString === '' || isIdentifier(keyPathString) || keyPathString.split('.').every(isIdentifier));
}

function isValidKeyPath(keyPath) {
    return isValidKeyPathString(keyPath) || Array.isArray(keyPath) && keyPath.length &&
    // Convert array from sparse to dense http://www.2ality.com/2012/06/dense-arrays.html
    Array.apply(null, keyPath).every(function (kpp) {
        // If W3C tests are accurate, it appears sequence<DOMString> implies `toString()`
        // See also https://heycam.github.io/webidl/#idl-DOMString
        return isValidKeyPathString(kpp.toString());
    });
}

exports.StringList = StringList;
exports.quote = quote;
exports.escapeDatabaseName = escapeDatabaseName;
exports.escapeStore = escapeStore;
exports.escapeIndex = escapeIndex;
exports.escapeIndexName = escapeIndexName;
exports.sqlLIKEEscape = sqlLIKEEscape;
exports.instanceOf = instanceOf;
exports.isObj = isObj;
exports.isDate = isDate;
exports.isBlob = isBlob;
exports.isRegExp = isRegExp;
exports.isFile = isFile;
exports.throwIfNotClonable = throwIfNotClonable;
exports.defineReadonlyProperties = defineReadonlyProperties;
exports.isValidKeyPath = isValidKeyPath;