import { isBoolean, isString } from '@intlify/shared'
import { resolve } from 'pathe'
import { build } from 'vite'
import vue from '@vitejs/plugin-vue'
import { JSDOM, VirtualConsole } from 'jsdom'
import vitePlugin from '../src/vite'
import webpackPlugin from '../src/webpack'
import webpack from 'webpack'
import merge from 'webpack-merge'
import memoryfs from 'memory-fs'
import { VueLoaderPlugin } from 'vue-loader'

import type { PluginOptions } from '../src/types'

type BundleResolve = {
  type: 'vite' | 'webpack'
  code: string
  map?: any // eslint-disable-line @typescript-eslint/no-explicit-any
  stats?: webpack.Stats
}

type BundleFunction = (
  fixture: string,
  options: Record<string, unknown>
) => Promise<BundleResolve>

export async function bundleVite(
  fixture: string,
  options: Record<string, unknown> = {}
): Promise<BundleResolve> {
  const input = (options.input as string) || './fixtures/entry.ts'
  const target = (options.target as string) || './fixtures'
  const include = (options.include as string[]) || [
    resolve(__dirname, './fixtures/**')
  ]
  const silent = isBoolean(options.silent)
    ? options.silent === false
      ? 'info'
      : 'silent'
    : 'silent'

  const alias: Record<string, string> = {
    vue: 'vue/dist/vue.runtime.esm-browser.js'
  }
  if (!fixture.startsWith('@')) {
    alias['~target'] = resolve(__dirname, target, fixture)
  }

  // @ts-ignore
  const plugins = [vue(), vitePlugin({ include, ...options })]
  const result = await build({
    logLevel: silent,
    resolve: {
      alias
    },
    plugins,
    build: {
      sourcemap: options.sourcemap as boolean,
      write: false,
      minify: false,
      rollupOptions: {
        input: resolve(__dirname, input)
      }
    }
  })
  return {
    type: 'vite',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    code: (result as any).output[0].code,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map: (result as any).output[0].map
  }
}

export function bundleWebpack(
  fixture: string,
  options: Record<string, unknown> = {}
): Promise<BundleResolve> {
  const VueLoader = (
    options.vueLoader ? options.vueLoader : VueLoaderPlugin
  ) as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const vueLoaderPath = (
    options.vueLoaderPath ? options.vueLoaderPath : 'vue-loader'
  ) as string
  const input = (options.input as string) || './fixtures/entry.js'
  const target = (options.target as string) || './fixtures'
  const include = (options.include as string[]) || [
    resolve(__dirname, './fixtures/**')
  ]
  const sourcemap = isBoolean(options.sourcemap) || true

  const baseConfig: webpack.Configuration = {
    mode: 'development',
    devtool: sourcemap ? 'source-map' : false,
    entry: resolve(__dirname, input),
    resolve: {
      alias: {
        '~target': resolve(__dirname, target, fixture)
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
          loader: vueLoaderPath
        }
      ]
    },
    plugins: [new VueLoader(), webpackPlugin({ include, ...options })]
  }

  // @ts-ignore
  const config = merge({}, baseConfig)
  // @ts-ignore
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
      resolve({
        type: 'webpack',
        code: mfs.readFileSync('/bundle.js').toString(),
        map: JSON.parse(mfs.readFileSync('/bundle.js.map').toString()),
        stats
      })
    })
  })
}

export async function bundleAndRun(
  fixture: string,
  bundler: BundleFunction,
  options: Record<string, unknown> = {}
) {
  options.defaultSFCLang = isString(options.defaultSFCLang)
    ? (options.defaultSFCLang as PluginOptions['defaultSFCLang'])
    : undefined
  options.globalSFCScope = isBoolean(options.globalSFCScope)
    ? options.globalSFCScope
    : undefined
  options.sourcemap = isBoolean(options.sourcemap) || false
  options.useClassComponent = isBoolean(options.useClassComponent) || false
  options.bridge = isBoolean(options.bridge) || false

  const { code, map } = await bundler(fixture, options)

  let dom: JSDOM | null = null
  let jsdomError
  try {
    dom = new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`, {
      runScripts: 'outside-only',
      virtualConsole: new VirtualConsole()
    })
    dom.window.eval(code)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.error(`JSDOM error:\n${e.stack}`)
    jsdomError = e
  }

  if (!dom) {
    return Promise.reject(new Error('Cannot assigned JSDOM instance'))
  }

  const { window } = dom
  const { module, exports } = window

  return Promise.resolve({
    window,
    module,
    exports,
    code,
    map,
    jsdomError
  })
}
