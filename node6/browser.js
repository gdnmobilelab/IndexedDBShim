'use strict';

var _setGlobalVars = require('./setGlobalVars.js');

var _setGlobalVars2 = _interopRequireDefault(_setGlobalVars);

var _CFG = require('./CFG.js');

var _CFG2 = _interopRequireDefault(_CFG);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_CFG2.default.win = typeof window !== 'undefined' ? window : self; // For Web Workers

(0, _setGlobalVars2.default)();