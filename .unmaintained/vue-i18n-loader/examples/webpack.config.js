const path = require('path')
const { VueLoaderPlugin } = require('vue-loader')

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: {
    composition: path.resolve(__dirname, './composition/main.js'),
    legacy: path.resolve(__dirname, './legacy/main.js'),
    global: path.resolve(__dirname, './global/main.js')
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    publicPath: '/dist/'
  },
  resolve: {
    alias: {
      // this isn't technically needed, since the default `vue` entry for bundlers
      // is a simple `export * from '@vue/runtime-dom`. However having this
      // extra re-export somehow causes webpack to always invalidate the module
      // on the first HMR update and causes the page to reload.
      vue: '@vue/runtime-dom'
    }
  },
  devServer: {
    stats: 'minimal',
    contentBase: __dirname
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      },
      {
        test: /\.js$/,
        loader: 'babel-loader'
      },
      {
        test: /\.(json5?|ya?ml)$/, // target json, json5, yaml and yml files
        type: 'javascript/auto',
        // Use `Rule.include` to specify the files of locale messages to be pre-compiled
        include: [
          path.resolve(__dirname, './composition/locales'),
          path.resolve(__dirname, './legacy/locales')
        ],
        use: [
          {
            loader: path.resolve(__dirname, '../lib/index.js'),
            options: {
              // Whether pre-compile number and boolean literal as message functions that return the string value, default `false`
              // forceStringify: true
            }
          }
        ]
      },
      {
        type: 'javascript/auto',
        resourceQuery: /blockType=i18n/,
        loader: path.resolve(__dirname, '../lib/index.js')
      }
    ]
  },
  plugins: [new VueLoaderPlugin()]
}
