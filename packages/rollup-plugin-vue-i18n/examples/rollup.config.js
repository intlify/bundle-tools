import VuePlugin from 'rollup-plugin-vue'
import replace from '@rollup/plugin-replace'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import path from 'path'

// NOTE:
//  load rollup-plugin-vue-18n from local.
//  In general, use `requirie('rollup-plugin-vue-i18n')`
const i18n = require(path.resolve(
  __dirname,
  '../../../lib/rollup-plugin-vue-i18n/src/index.js'
)).default

export default [
  {
    input: path.resolve(__dirname, `./${process.env.BUILD}/main.js`),
    output: {
      file: path.resolve(__dirname, `./${process.env.BUILD}/index.js`),
      format: 'cjs'
    },
    plugins: [
      replace({
        'process.env.NODE_ENV': JSON.stringify('production')
      }),
      VuePlugin({ customBlocks: ['i18n'] }),
      // set `rollup-plugin-vue-i18n` after **`rollup-plugin-vue`**
      i18n({
        // `include` option for i18n resources bundling
        include: path.resolve(__dirname, `./${process.env.BUILD}/locales/**`)
      }),
      resolve(),
      commonjs()
    ]
  }
]
