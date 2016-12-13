/* globals GLOBAL */

import setGlobalVars from './setGlobalVars.js';
import CFG from './CFG.js';

export default (function (openDatabase) {
    CFG.win = { openDatabase: openDatabase };
    return setGlobalVars;
});