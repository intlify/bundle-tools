import { isBoolean, isString } from '@intlify/shared'
import vue from '@vitejs/plugin-vue'
import fg from 'fast-glob'
import { JSDOM, VirtualConsole } from 'jsdom'
import memoryfs from 'memory-fs'
import { resolve } from 'pathe'
import { build } from 'vite'
import { VueLoaderPlugin } from 'vue-loader'
import webpack from 'webpack'
import merge from 'webpack-merge'
import vitePlugin from '../src/vite'
import webpackPlugin from '../src/webpack'

import type { PluginOptions } from '../src/types'

let ignoreIds: string[] | null = null

type BundleResolve = {
  type: 'vite' | 'webpack'
  code: string
  map?: any
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
    resolve(__dirname, './fixtures/locales/**')
  ]
  const silent = isBoolean(options.silent)
    ? options.silent === false
      ? 'info'
      : 'silent'
    : 'silent'
  options.strictMessage = isBoolean(options.strictMessage)
    ? options.strictMessage
    : true
  options.escapeHtml = !!options.escapeHtml
  options.optimizeTranslationDirective = !!options.optimizeTranslationDirective

  const alias: Record<string, string> = {
    vue: 'vue/dist/vue.esm-bundler.js'
  }
  if (!fixture.startsWith('@')) {
    alias['~target'] = resolve(__dirname, target, fixture)
  }

  if (ignoreIds == null) {
    ignoreIds = await fg(resolve(__dirname, './fixtures/directives/*.vue'))
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
        input: resolve(__dirname, input),

        onLog: (_level: any, log: any) => {
          // NOTE:
          // ignore the following messages
          // - "Error when using sourcemap for reporting an error: Can't resolve original location of error.",
          // - '"undefined" is not exported by "node_modules/vue/dist/vue.esm-bundler.js", imported by "packages/unplugin-vue-i18n/test/fixtures/directives/xxx.vue".'
          if (ignoreIds?.includes(log.id)) {
            return // ignore
          }
        }
      }
    }
  })
  return {
    type: 'vite',

    code: (result as any).output[0].code,

    map: (result as any).output[0].map
  }
}

export function bundleWebpack(
  fixture: string,
  options: Record<string, unknown> = {}
): Promise<BundleResolve> {
  const VueLoader = (
    options.vueLoader ? options.vueLoader : VueLoaderPlugin
  ) as any
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

  const mfs = new memoryfs()
  compiler.outputFileSystem = mfs

  return new Promise((resolve, reject) => {
    compiler.run((err, stats: any) => {
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
  options.bridge = isBoolean(options.bridge) || false
  options.legacy = isBoolean(options.legacy) || false
  options.vueVersion = isString(options.vueVersion)
    ? options.vueVersion
    : 'v2.6'
  options.allowDynamic = isBoolean(options.allowDynamic) || false
  options.strictMessage = isBoolean(options.strictMessage)
    ? options.strictMessage
    : true
  options.escapeHtml = !!options.escapeHtml
  options.optimizeTranslationDirective = !!options.optimizeTranslationDirective

  const { code, map } = await bundler(fixture, options)

  let dom: JSDOM | null = null
  let jsdomError
  try {
    dom = new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`, {
      runScripts: 'outside-only',
      virtualConsole: new VirtualConsole()
    })
    dom.window.eval(code)
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
