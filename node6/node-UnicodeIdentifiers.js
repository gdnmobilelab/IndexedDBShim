'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _UnicodeIdentifiers = require('./UnicodeIdentifiers');

var UnicodeIdentifiers = _interopRequireWildcard(_UnicodeIdentifiers);

var _websql = require('websql');

var _websql2 = _interopRequireDefault(_websql);

var _setGlobalVars = require('./setGlobalVars.js');

var _setGlobalVars2 = _interopRequireDefault(_setGlobalVars);

var _CFG = require('./CFG.js');

var _CFG2 = _interopRequireDefault(_CFG);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

/* globals GLOBAL, shimIndexedDB */


_CFG2.default.win = { openDatabase: _websql2.default };
// END: Same code as in node.js

// BEGIN: Same code as in node.js
var __setGlobalVars = function __setGlobalVars() {
    (0, _setGlobalVars2.default)();
    shimIndexedDB.__setUnicodeIdentifiers(UnicodeIdentifiers);
};

exports.default = __setGlobalVars;
module.exports = exports['default'];