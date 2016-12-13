import nodeResolve from 'rollup-plugin-node-resolve';
import commonJS from 'rollup-plugin-commonjs';
import buble from 'rollup-plugin-buble';

export default {
    plugins: [
        buble(),
        nodeResolve({
            preferBuiltins: false,
            jsnext: true
        }),
        commonJS({
            include: [
                'node_modules/**'
            ]
        })
    ]
}