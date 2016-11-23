'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.createDOMException = exports.DOMException = exports.findError = exports.logError = undefined;

var _CFG = require('./CFG.js');

var _CFG2 = _interopRequireDefault(_CFG);

var _util = require('./util.js');

var util = _interopRequireWildcard(_util);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Creates a native DOMException, for browsers that support it
 * @returns {DOMException}
 */
function createNativeDOMException(name, message) {
    return new DOMException.prototype.constructor(message, name || 'DOMException');
}

/**
 * Creates a generic Error object
 * @returns {Error}
 */
function createError(name, message) {
    var e = new Error(message); // DOMException uses the same `toString` as `Error`, so no need to add
    e.name = name || 'DOMException';
    e.message = message;
    return e;
}

/**
 * Logs detailed error information to the console.
 * @param {string} name
 * @param {string} message
 * @param {string|Error|null} error
 */
function logError(name, message, error) {
    if (_CFG2.default.DEBUG) {
        if (error && error.message) {
            error = error.message;
        }

        var method = typeof console.error === 'function' ? 'error' : 'log';
        console[method](name + ': ' + message + '. ' + (error || ''));
        console.trace && console.trace();
    }
};

function isErrorOrDOMErrorOrDOMException(obj) {
    return util.isObj(obj) && typeof obj.name === 'string';
}

/**
 * Finds the error argument.  This is useful because some WebSQL callbacks
 * pass the error as the first argument, and some pass it as the second argument.
 * @param {array} args
 * @returns {Error|DOMException|undefined}
 */
function findError(args) {
    var err = void 0;
    if (args) {
        if (args.length === 1) {
            return args[0];
        }
        for (var i = 0; i < args.length; i++) {
            var arg = args[i];
            if (isErrorOrDOMErrorOrDOMException(arg)) {
                return arg;
            } else if (arg && typeof arg.message === 'string') {
                err = arg;
            }
        }
    }
    return err;
};

var test = void 0,
    useNativeDOMException = false;

// Test whether we can use the browser's native DOMException class
try {
    test = createNativeDOMException('test name', 'test message');
    if (isErrorOrDOMErrorOrDOMException(test) && test.name === 'test name' && test.message === 'test message') {
        // Native DOMException works as expected
        useNativeDOMException = true;
    }
} catch (e) {}

var createDOMException = void 0,
    shimDOMException = void 0;
if (useNativeDOMException) {
    exports.DOMException = shimDOMException = DOMException;
    exports.createDOMException = createDOMException = function createDOMException(name, message, error) {
        logError(name, message, error);
        return createNativeDOMException(name, message);
    };
} else {
    exports.DOMException = shimDOMException = Error;
    exports.createDOMException = createDOMException = function createDOMException(name, message, error) {
        logError(name, message, error);
        return createError(name, message);
    };
}

exports.logError = logError;
exports.findError = findError;
exports.DOMException = shimDOMException;
exports.createDOMException = createDOMException;