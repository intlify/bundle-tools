/* eslint-disable @typescript-eslint/no-explicit-any */

import path from 'path'
import { promises as fs } from 'fs'
import webpack from 'webpack'
import merge from 'webpack-merge'
import memoryfs from 'memory-fs'
import { JSDOM, VirtualConsole, DOMWindow } from 'jsdom'
import { VueLoaderPlugin } from 'vue-loader'
import IntlifyVuePlugin from '../src/plugin'

type BundleResolve = {
  code: string
  stats: webpack.Stats
}

type BundleResolveResolve = BundleResolve & {
  jsdomError: any
  instance: any
  window: DOMWindow
  module: any
  exports: any
}

export function bundle(
  fixture: string,
  options: Record<string, any> = {}
): Promise<BundleResolve> {
  const baseConfig: webpack.Configuration = {
    mode: 'development',
    devtool: 'source-map',
    entry: path.resolve(__dirname, './fixtures/entry.js'),
    resolve: {
      alias: {
        '~target': path.resolve(__dirname, './fixtures', fixture)
      }
    },
    output: {
      path: '/',
      filename: 'bundle.js'
    },
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader'
        },
        {
          resourceQuery: /blockType=i18n/,
          type: 'javascript/auto',
          use: [
            {
              loader: path.resolve(__dirname, '../src/index.ts'),
              options
            }
          ]
        }
      ]
    },
    plugins: [new VueLoaderPlugin()]
  }

  const config = merge({}, baseConfig)
  const compiler = webpack(config)

  const mfs = new memoryfs() // eslint-disable-line
  compiler.outputFileSystem = mfs

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        return reject(err)
      }
      if (stats.hasErrors()) {
        return reject(new Error(stats.toJson().errors.join(' | ')))
      }
      resolve({ code: mfs.readFileSync('/bundle.js').toString(), stats })
    })
  })
}

export function bundleEx(
  fixture: string,
  options: Record<string, any> = {}
): Promise<BundleResolve> {
  const baseConfig: webpack.Configuration = {
    mode: 'development',
    devtool: 'source-map',
    entry: path.resolve(__dirname, './fixtures/entry.js'),
    resolve: {
      alias: {
        '~target': path.resolve(__dirname, './fixtures', fixture)
      }
    },
    output: {
      path: '/',
      filename: 'bundle.js'
    },
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader'
        },
        {
          test: /\.(json5?|ya?ml)$/,
          type: 'javascript/auto',
          include: [path.resolve(__dirname, './fixtures/locales')],
          use: [
            {
              loader: path.resolve(__dirname, '../src/index.ts'),
              options
            }
          ]
        },
        {
          resourceQuery: /blockType=i18n/,
          type: 'javascript/auto',
          use: [
            {
              loader: path.resolve(__dirname, '../src/index.ts'),
              options
            }
          ]
        }
      ]
    },
    plugins: [new VueLoaderPlugin(), new IntlifyVuePlugin(options.intlify)]
  }

  const config = merge({}, baseConfig)
  const compiler = webpack(config)

  const mfs = new memoryfs() // eslint-disable-line
  compiler.outputFileSystem = mfs

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        return reject(err)
      }
      if (stats.hasErrors()) {
        return reject(new Error(stats.toJson().errors.join(' | ')))
      }
      resolve({ code: mfs.readFileSync('/bundle.js').toString(), stats })
    })
  })
}

export function bundleLocale(
  fixture: string,
  options: Record<string, any> = {}
): Promise<BundleResolve> {
  const baseConfig: webpack.Configuration = {
    mode: 'development',
    devtool: 'source-map',
    entry: path.resolve(__dirname, './fixtures/locale.js'),
    resolve: {
      alias: {
        '~target': path.resolve(__dirname, './fixtures/locales', fixture)
      }
    },
    output: {
      path: '/',
      filename: 'bundle.js'
    },
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader'
        },
        {
          test: /\.(json5?|ya?ml)$/,
          type: 'javascript/auto',
          include: [path.resolve(__dirname, './fixtures/locales')],
          use: [
            {
              loader: path.resolve(__dirname, '../src/index.ts'),
              options
            }
          ]
        }
      ]
    },
    plugins: [new VueLoaderPlugin()]
  }

  const config = merge({}, baseConfig)
  const compiler = webpack(config)

  const mfs = new memoryfs() // eslint-disable-line
  compiler.outputFileSystem = mfs

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        return reject(err)
      }
      if (stats.hasErrors()) {
        return reject(new Error(stats.toJson().errors.join(' | ')))
      }
      resolve({ code: mfs.readFileSync('/bundle.js').toString(), stats })
    })
  })
}

export async function bundleAndRun(
  fixture: string,
  bundleFn = bundle,
  config = {}
): Promise<BundleResolveResolve> {
  const { code, stats } = await bundleFn(fixture, config)
  // console.log('code', code)

  let dom: JSDOM | null = null
  let jsdomError
  try {
    dom = new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`, {
      runScripts: 'outside-only',
      virtualConsole: new VirtualConsole()
    })
    dom.window.eval(code)
  } catch (e) {
    console.error(`JSDOM error:\n${e.stack}`)
    jsdomError = e
  }

  if (!dom) {
    return Promise.reject(new Error('Cannot assigned JSDOM instance'))
  }

  const { window } = dom
  const { module, exports } = window
  const instance = {}
  if (module && module.beforeCreate) {
    // eslint-disable-next-line @typescript-eslint/ban-types
    module.beforeCreate.forEach((hook: Function) => hook.call(instance))
  }

  return Promise.resolve({
    window,
    module,
    exports,
    instance,
    code,
    jsdomError,
    stats
  })
}

export async function readFile(
  filepath: string,
  encoding: BufferEncoding = 'utf-8'
): Promise<{ filename: string; source: string }> {
  const filename = path.resolve(__dirname, filepath)
  const source = await fs.readFile(filename, { encoding })
  return { filename, source }
}

/* eslint-enable @typescript-eslint/no-explicit-any */
