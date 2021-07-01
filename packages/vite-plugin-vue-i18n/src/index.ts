;(async () => {
  try {
    await import('vue-i18n')
  } catch (e) {
    throw new Error(
      '@intlify/vite-plugin-vue-i18n requires vue-i18n to be present in the dependency tree.'
    )
  }
})()

import { promises as fs } from 'fs'
import path from 'path'
import { isArray, isBoolean, isEmptyObject, isString } from '@intlify/shared'
import { createFilter } from '@rollup/pluginutils'
import { generateJSON, generateYAML } from '@intlify/cli'
import fg from 'fast-glob'
import { debug as Debug } from 'debug'
import { parseVueRequest } from './query'
import { normalizePath } from 'vite'

import type { Plugin, ResolvedConfig, UserConfig } from 'vite'
import type { CodeGenOptions, DevEnv } from '@intlify/cli'
import type { VitePluginVueI18nOptions } from './options'

const debug = Debug('vite-plugin-vue-i18n')

const INTLIFY_BUNDLE_IMPORT_ID = '@intlify/vite-plugin-vue-i18n/messages'

function pluginI18n(
  options: VitePluginVueI18nOptions = { forceStringify: false }
): Plugin {
  debug('plugin options:', options)

  // use `normalizePath` for `options.include`
  let include = options.include
  if (include) {
    if (isArray(include)) {
      include = include.map(item => normalizePath(item))
    } else if (isString(include)) {
      include = normalizePath(include)
    }
  }

  const filter = createFilter(include)
  const runtimeOnly = isBoolean(options.runtimeOnly)
    ? options.runtimeOnly
    : true
  const compositionOnly = isBoolean(options.compositionOnly)
    ? options.compositionOnly
    : true
  const fullIinstall = isBoolean(options.fullInstall)
    ? options.fullInstall
    : true
  const defaultSFCLang = isString(options.defaultSFCLang)
    ? options.defaultSFCLang
    : undefined
  const globalSFCScope = isBoolean(options.globalSFCScope)
    ? options.globalSFCScope
    : false
  let config: ResolvedConfig | null = null

  return {
    name: 'vite-plugin-vue-i18n',

    config(config: UserConfig, { command }) {
      if (command === 'build' && runtimeOnly) {
        normalizeConfigResolveAliias(config)
        if (isArray(config.resolve!.alias)) {
          config.resolve!.alias.push({
            find: 'vue-i18n',
            replacement: 'vue-i18n/dist/vue-i18n.runtime.esm-bundler.js'
          })
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(config.resolve!.alias as any)['vue-i18n'] =
            'vue-i18n/dist/vue-i18n.runtime.esm-bundler.js'
        }
        debug('set vue-i18n runtime only')
      }

      config.define = config.define || {}
      config.define['__VUE_I18N_LEGACY_API__'] = !compositionOnly
      debug(
        `set __VUE_I18N_LEGACY_API__ is '${config.define['__VUE_I18N_LEGACY_API__']}'`
      )

      config.define['__VUE_I18N_FULL_INSTALL__'] = fullIinstall
      debug(
        `set __VUE_I18N_FULL_INSTALL__ is '${config.define['__VUE_I18N_FULL_INSTALL__']}'`
      )

      config.define['__VUE_I18N_PROD_DEVTOOLS__'] = false
    },

    configResolved(_config: ResolvedConfig) {
      // store config
      config = _config

      // json transform handling
      const jsonPlugin = config.plugins.find(p => p.name === 'vite:json')
      if (jsonPlugin) {
        const orgTransform = jsonPlugin.transform // backup @rollup/plugin-json
        jsonPlugin.transform = async function (code: string, id: string) {
          if (!/\.json$/.test(id)) {
            return null
          }
          if (filter(id)) {
            const map = this.getCombinedSourcemap()
            debug('override json plugin', code, map)
            return Promise.resolve({
              code,
              map
            })
          } else {
            debug('org json plugin')
            return orgTransform!.apply(this, [code, id])
          }
        }
      }
    },

    resolveId(id: string) {
      if (id === INTLIFY_BUNDLE_IMPORT_ID) {
        return id
      }
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async load(id: string, ssr: boolean) {
      if (id === INTLIFY_BUNDLE_IMPORT_ID && include) {
        let resourcePaths = [] as string[]
        const includePaths = isArray(include) ? include : [include]
        for (const inc of includePaths) {
          resourcePaths = [...(await fg(inc))]
        }
        // TODO: source-map
        const code = await generateBundleResources(
          resourcePaths,
          config != null ? config.isProduction : false,
          options.forceStringify!
        )
        return Promise.resolve(code)
      }
    },

    async handleHotUpdate({ file, server }) {
      if (/\.(json5?|ya?ml)$/.test(file)) {
        const module = server.moduleGraph.getModuleById(
          INTLIFY_BUNDLE_IMPORT_ID
        )
        if (module) {
          server.moduleGraph.invalidateModule(module)
          return [module!]
        }
      }
    },

    async transform(code: string, id: string) {
      const { filename, query } = parseVueRequest(id)
      debug('transform', id, JSON.stringify(query))

      const parseOptions = getOptions(
        filename,
        config != null ? config.isProduction : false,
        query as Record<string, unknown>,
        options.forceStringify
      ) as CodeGenOptions
      debug('parseOptions', parseOptions)

      let langInfo = 'json'
      if (!query.vue) {
        if (/\.(json5?|ya?ml)$/.test(id) && filter(id)) {
          langInfo = path.parse(filename).ext
          // NOTE:
          // `.json` is handled default in vite, and it's transformed to JS object.
          let _source = code
          if (langInfo === '.json') {
            _source = await getRaw(id)
          }
          const generate = /\.?json5?/.test(langInfo)
            ? generateJSON
            : generateYAML
          const { code: generatedCode } = generate(_source, parseOptions)
          debug('generated code', generatedCode)
          // TODO: error handling & sourcempa
          return Promise.resolve(generatedCode)
        } else {
          return Promise.resolve(code)
        }
      } else {
        // for Vue SFC
        if (isCustomBlock(query as Record<string, unknown>)) {
          if ('src' in query) {
            if (isString(query.lang)) {
              langInfo = query.lang === 'i18n' ? 'json' : query.lang
            } else if (defaultSFCLang) {
              langInfo = defaultSFCLang
            }
          } else {
            if (isString(query.lang)) {
              langInfo = query.lang
            } else if (defaultSFCLang) {
              langInfo = defaultSFCLang
            }
          }
          if (!parseOptions.isGlobal && globalSFCScope) {
            parseOptions.isGlobal = true
          }
          const generate = /\.?json5?/.test(langInfo)
            ? generateJSON
            : generateYAML
          const { code: generatedCode } = generate(code, parseOptions)
          debug('generated code', generatedCode)
          // TODO: error handling & sourcempa
          return Promise.resolve(generatedCode)
        } else {
          return Promise.resolve(code)
        }
      }
    }
  }
}

function normalizeConfigResolveAliias(config: UserConfig): void {
  // NOTE: cannot resolve Optional Chaining in jest E2E ...
  if (config.resolve && config.resolve.alias) {
    return
  }

  if (!config.resolve) {
    config.resolve = { alias: [] }
  } else if (!config.resolve.alias) {
    config.resolve.alias = []
  }
}

async function getRaw(path: string): Promise<string> {
  return fs.readFile(path, { encoding: 'utf-8' })
}

function isCustomBlock(query: Record<string, unknown>): boolean {
  // NOTE: should be more improvement. difference query type and blocktype in some environment ...
  return (
    !isEmptyObject(query) &&
    'vue' in query &&
    (query['type'] === 'custom' ||
      query['type'] === 'i18n' ||
      query['blockType'] === 'i18n')
  )
}

function getOptions(
  filename: string,
  isProduction: boolean,
  query: Record<string, unknown>,
  forceStringify = false
): Record<string, unknown> {
  const mode: DevEnv = isProduction ? 'production' : 'development'

  const baseOptions = {
    filename,
    forceStringify,
    env: mode,
    onWarn: (msg: string): void => {
      console.warn(`[vite-plugin-vue-i18n]: ${filename} ${msg}`)
    },
    onError: (msg: string): void => {
      console.error(`[vite-plugin-vue-i18n]: ${filename} ${msg}`)
    }
  }

  if (isCustomBlock(query)) {
    return Object.assign(baseOptions, {
      type: 'sfc',
      locale: isString(query.locale) ? query.locale : '',
      isGlobal: query.global != null
    })
  } else {
    return Object.assign(baseOptions, {
      type: 'plain',
      isGlobal: false
    })
  }
}

async function generateBundleResources(
  resources: string[],
  isProduction: boolean,
  forceStringify: boolean
) {
  const codes = []
  for (const res of resources) {
    debug(`${res} bundle loading ...`)
    if (/\.(json5?|ya?ml)$/.test(res)) {
      const { ext, name } = path.parse(res)
      const source = await getRaw(res)
      const generate = /json5?/.test(ext) ? generateJSON : generateYAML
      const parseOptions = getOptions(
        res,
        isProduction,
        {},
        forceStringify
      ) as CodeGenOptions
      parseOptions.type = 'bare'
      const { code } = generate(source, parseOptions)
      debug('generated code', code)
      codes.push(`${JSON.stringify(name)}: ${code}`)
    }
  }
  return `export default {
  ${codes.join(`,\n`)}
}`
}

// overwrite for cjs require('...')() usage
export default pluginI18n
export const vueI18n = pluginI18n
