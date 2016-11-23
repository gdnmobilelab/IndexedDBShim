'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
var map = {};
var CFG = {};

['DEBUG', // boolean
'DEFAULT_DB_SIZE', // 4 * 1024 * 1024 or 25 * 1024 * 1024 in Safari
'cursorPreloadPackSize', // 100
'win', // (window on which there may be an `openDatabase` method (if any)
//  for WebSQL; the browser throws if attempting to call
//  `openDatabase` without the window)
// See optional dynamic `System.import()` loading API (shimIndexedDB.__setUnicodeIdentifiers)
//    of these large regular expression strings:
'UnicodeIDStart', // See `src/UnicodeIdentifiers.js`
'UnicodeIDContinue' // See `src/UnicodeIdentifiers.js`
].forEach(function (prop) {
    Object.defineProperty(CFG, prop, {
        get: function get() {
            return map[prop];
        },
        set: function set(val) {
            map[prop] = val;
        }
    });
});

exports.default = CFG;
module.exports = exports['default'];