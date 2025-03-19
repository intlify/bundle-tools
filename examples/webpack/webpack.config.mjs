import { dirname, resolve, join } from 'path'
import { fileURLToPath } from 'url'
import { VueLoaderPlugin } from 'vue-loader'
import VueI18nPlugin from '../../packages/unplugin-vue-i18n/lib/webpack.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function transformI18nBlock(source) {
  const sourceCopy = source
  const block = JSON.parse(sourceCopy.replace(/[\n\s]/g, '').replace(/,\]$/, ']'))
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

export default {
  mode: 'development',
  devtool: 'source-map',
  entry: resolve(__dirname, './src/main.js'),
  output: {
    path: resolve(__dirname, 'dist'),
    filename: '[name].js',
    publicPath: '/dist/'
  },
  resolve: {
    alias: {
      vue: resolve(__dirname, '../../node_modules/vue/dist/vue.esm-bundler.js')
    }
  },
  devServer: {
    static: {
      directory: join(__dirname, './')
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {
          transpileOnly: true
        }
      },
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
      include: [resolve(__dirname, './src/locales/**')],
      transformI18nBlock: transformI18nBlock
    })
  ]
}
