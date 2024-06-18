const path = require('path')
const { VueLoaderPlugin } = require('vue-loader')
const VueI18nPlugin = require('../../packages/unplugin-vue-i18n/lib/webpack.cjs')

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
      include: [path.resolve(__dirname, './src/locales/**')]
    })
  ]
}
