'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _websql = require('websql');

var _websql2 = _interopRequireDefault(_websql);

var _setGlobalVars = require('./setGlobalVars.js');

var _setGlobalVars2 = _interopRequireDefault(_setGlobalVars);

var _CFG = require('./CFG.js');

var _CFG2 = _interopRequireDefault(_CFG);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_CFG2.default.win = { openDatabase: _websql2.default }; /* globals GLOBAL */

exports.default = _setGlobalVars2.default;
module.exports = exports['default'];