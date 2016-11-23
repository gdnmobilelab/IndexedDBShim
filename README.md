# IndexedDB Polyfill for Node 6

This is a fork of [IndexedDBShim](https://github.com/axemclion/IndexedDBShim) with the configuration
changed to output a build optimised (using the babel-preset-node6 preset) for Node 6. The existing
configuration outputs a single file using Grunt that doesn't work properly with NPM 3 (because it
makes assumptions about node_modules) - this sidesteps the whole issue.

It also removes the dependency on `babel-polyfill`, as I don't *think* it needs it.

Safe to assume that this will work with node versions >=6, but probably not < 6.
