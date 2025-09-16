import { isBoolean, isString } from '@intlify/shared'
import vue from '@vitejs/plugin-vue'
import fg from 'fast-glob'
import { JSDOM, VirtualConsole } from 'jsdom'
import memoryfs from 'memory-fs'
import { resolve } from 'node:path'
import { build as buildRollupVite } from 'rollup-vite'
import { build as buildRolldownVite } from 'vite'
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

type ViteBulderType = 'rollup' | 'rolldown'

type BundleFunction = (
  fixture: string,
  options: Record<string, unknown>,
  viteType: ViteBulderType
) => Promise<BundleResolve>

const VITE_BUILDERS: Record<ViteBulderType, typeof buildRollupVite | typeof buildRolldownVite> = {
  rollup: buildRollupVite,
  rolldown: buildRolldownVite
}

export async function bundleVite(
  fixture: string,
  options: Record<string, unknown> = {},
  viteType: ViteBulderType = 'rolldown'
): Promise<BundleResolve> {
  const input = (options.input as string) || './fixtures/entry.ts'
  const target = (options.target as string) || './fixtures'
  const include = (options.include as string[]) || [resolve(__dirname, './fixtures/locales/**')]
  const silent = isBoolean(options.silent)
    ? options.silent === false
      ? 'info'
      : 'silent'
    : 'silent'
  options.strictMessage = isBoolean(options.strictMessage) ? options.strictMessage : true
  options.escapeHtml = !!options.escapeHtml
  options.optimizeTranslationDirective = !!options.optimizeTranslationDirective

  const alias: Record<string, string> = {
    vue: resolve(import.meta.dirname, '../node_modules/vue/dist/vue.esm-bundler.js')
  }
  if (!fixture.startsWith('@')) {
    alias['~target'] = resolve(__dirname, target, fixture)
  }

  if (ignoreIds == null) {
    ignoreIds = await fg(resolve(__dirname, './fixtures/directives/*.vue'))
  }

  const build = VITE_BUILDERS[viteType]
  // @ts-ignore
  const plugins = [vue(), vitePlugin({ include, ...options })]
  const result = await build({
    logLevel: silent,
    resolve: {
      alias
    },
    // @ts-ignore -- NOTE: ignore type error for testing
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
  const VueLoader = (options.vueLoader ? options.vueLoader : VueLoaderPlugin) as any
  const vueLoaderPath = (options.vueLoaderPath ? options.vueLoaderPath : 'vue-loader') as string
  const input = (options.input as string) || './fixtures/entry.js'
  const target = (options.target as string) || './fixtures'
  const include = (options.include as string[]) || [
    resolve(__dirname, './fixtures/*.{json,yaml,yml,json5,js,ts}')
  ]
  const exclude = (options.exclude as string[]) || [resolve(__dirname, './fixtures/entry.[jt]s')]
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
    plugins: [new VueLoader(), webpackPlugin({ include, exclude, ...options })]
  }

  const config = merge({}, baseConfig)
  const compiler = webpack(config)
  if (compiler == null) {
    return Promise.reject(new Error('Cannot create webpack compiler'))
  }

  const mfs = new memoryfs()
  // @ts-expect-error -- FIXME: type error
  compiler.outputFileSystem = mfs

  return new Promise((resolve, reject) => {
    compiler.run((err, stats: any) => {
      if (err) {
        return reject(err)
      }
      if (stats.hasErrors()) {
        console.log(stats.toJson().errors)
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
  options.globalSFCScope = isBoolean(options.globalSFCScope) ? options.globalSFCScope : undefined
  options.sourcemap = isBoolean(options.sourcemap) || false
  options.bridge = isBoolean(options.bridge) || false
  options.legacy = isBoolean(options.legacy) || false
  options.vueVersion = isString(options.vueVersion) ? options.vueVersion : 'v2.6'
  options.allowDynamic = isBoolean(options.allowDynamic) || false
  options.strictMessage = isBoolean(options.strictMessage) ? options.strictMessage : true
  options.escapeHtml = !!options.escapeHtml
  options.optimizeTranslationDirective = !!options.optimizeTranslationDirective

  const rolldownVersion = ((await import('vite')) as any).rolldownVersion
  const { code, map } = await bundler(fixture, options, !!rolldownVersion ? 'rolldown' : 'rollup')

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
