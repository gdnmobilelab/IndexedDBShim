'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _setGlobalVars = require('./setGlobalVars.js');

var _setGlobalVars2 = _interopRequireDefault(_setGlobalVars);

var _CFG = require('./CFG.js');

var _CFG2 = _interopRequireDefault(_CFG);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* globals GLOBAL */

exports.default = openDatabase => {
    _CFG2.default.win = { openDatabase: openDatabase };
    return _setGlobalVars2.default;
};

module.exports = exports['default'];