import EventTarget from 'eventtarget';
import * as util from './util.js';

var ShimEvent = EventTarget.EventPolyfill;

function createEvent(type, debug, evInit) {
    var ev = new ShimEvent(type, evInit);
    ev.debug = debug;
    return ev;
}

// Babel apparently having a problem adding `hasInstance` to a class, so we are redefining as a function
function IDBVersionChangeEvent(type, eventInitDict) {
    // eventInitDict is a IDBVersionChangeEventInit (but is not defined as a global)
    ShimEvent.call(this, type);
    Object.defineProperty(this, 'oldVersion', {
        enumerable: true,
        configurable: true,
        get: function get() {
            return eventInitDict.oldVersion;
        }
    });
    Object.defineProperty(this, 'newVersion', {
        enumerable: true,
        configurable: true,
        get: function get() {
            return eventInitDict.newVersion;
        }
    });
}
IDBVersionChangeEvent.prototype = new ShimEvent('bogus');
IDBVersionChangeEvent.prototype.constructor = IDBVersionChangeEvent;
IDBVersionChangeEvent.prototype.toString = function () {
    return '[object IDBVersionChangeEvent]';
};

Object.defineProperty(IDBVersionChangeEvent, Symbol.hasInstance, {
    value: function value(obj) {
        return util.isObj(obj) && 'oldVersion' in obj && typeof obj.defaultPrevented === 'boolean';
    }
});

// We don't add to polyfill as this might not be the desired implementation
Object.defineProperty(ShimEvent, Symbol.hasInstance, {
    value: function value(obj) {
        return util.isObj(obj) && 'target' in obj && typeof obj.bubbles === 'boolean';
    }
});

export { IDBVersionChangeEvent, createEvent, ShimEvent }; // Event not currently in use