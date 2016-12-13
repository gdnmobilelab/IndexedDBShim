'use strict';

var _UnicodeIdentifiers = require('./UnicodeIdentifiers');

var UnicodeIdentifiers = _interopRequireWildcard(_UnicodeIdentifiers);

var _setGlobalVars = require('./setGlobalVars.js');

var _setGlobalVars2 = _interopRequireDefault(_setGlobalVars);

var _CFG = require('./CFG.js');

var _CFG2 = _interopRequireDefault(_CFG);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

// BEGIN: Same code as in browser.js
_CFG2.default.win = typeof window !== 'undefined' ? window : self; // For Web Workers

/* global shimIndexedDB */
(0, _setGlobalVars2.default)();
// END: Same code as in browser.js

const __setUnicodeIdentifiers = shimIndexedDB.__setUnicodeIdentifiers.bind(shimIndexedDB);
shimIndexedDB.__setUnicodeIdentifiers = function () {
    __setUnicodeIdentifiers(UnicodeIdentifiers);
};

shimIndexedDB.__setUnicodeIdentifiers();