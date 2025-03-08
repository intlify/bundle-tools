// @ts-check
const path = require('path')
const { VueLoaderPlugin } = require('vue-loader')
const VueI18nPlugin = require('../../packages/unplugin-vue-i18n/lib/rspack.cjs')

function transformI18nBlock(source) {
  const sourceCopy = source
  const block = JSON.parse(
    sourceCopy.replace(/[\n\s]/g, '').replace(/,\]$/, ']')
  )
  if (Array.isArray(block)) {
    const transformedBlock = JSON.stringify({
      en: {
        language: 'Language',
        hello: 'hello, world!'
      },
      ja: {
        language: '言語',
        hello: 'こんにちは、世界！'
      }
    })
    return transformedBlock
  }
  return source
}

/**
 * @type {import('@rspack/core').RspackOptions}
 **/
module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: path.resolve(__dirname, './src/main.js'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    publicPath: '/dist/'
  },
  resolve: {
    alias: {
      vue: path.resolve(
        __dirname,
        '../../node_modules/vue/dist/vue.esm-bundler.js'
      )
    }
  },
  devServer: {
    static: {
      directory: path.join(__dirname, './')
    }
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
      }
    ]
  },
  plugins: [
    new VueLoaderPlugin(),
    VueI18nPlugin({
      include: [path.resolve(__dirname, './src/locales/**')],
      transformI18nBlock: transformI18nBlock
    })
  ]
}
