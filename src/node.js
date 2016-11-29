/* globals GLOBAL */

import setGlobalVars from './setGlobalVars.js';
import CFG from './CFG.js';

export default (openDatabase) => {
    CFG.win = {openDatabase: openDatabase};
    return setGlobalVars
}

