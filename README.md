# IndexedDB Polyfill for Node 6

This is a fork of [IndexedDBShim](https://github.com/axemclion/IndexedDBShim) with the configuration
changed to output a build optimised (using the babel-preset-node6 preset) for Node 6. The existing
configuration outputs a single file using Grunt that doesn't work properly with NPM 3 (because it
makes assumptions about node_modules) - this sidesteps the whole issue. It also removes the dependency
on `node-websql` - not because it doesn't need it, but so that you can provide a custom implementation.
So now you create it like so:

    const openDatabase = require('websql');
    const idbShim = require('indexeddbshim-node6')(openDatabase);

It also removes the dependency on `babel-polyfill`, as I don't *think* it needs it.

## Rollup

There's also a [Rollup](http://rollup.js.org) compatible version of the library that preserves the ES6
module declarations. Use it like so:

    import idbShim from 'indexeddbshim/rollup-ready/node.js';
 

Safe to assume that this will work with node versions >=6, but probably not < 6.
