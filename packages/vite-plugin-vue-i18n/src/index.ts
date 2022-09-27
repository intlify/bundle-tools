import { promises as fs } from 'fs'
import path from 'path'
import { isArray, isBoolean, isEmptyObject, isString } from '@intlify/shared'
import { createFilter } from '@rollup/pluginutils'
import {
  generateJSON,
  generateYAML,
  checkInstallPackage,
  checkVueI18nBridgeInstallPackage
} from '@intlify/bundle-utils'
import fg from 'fast-glob'
import createDebug from 'debug'
import { normalizePath } from 'vite'
import { RawSourceMap } from 'source-map'
import { parseVueRequest } from './query'

import type { Plugin, ResolvedConfig, UserConfig } from 'vite'
import type { CodeGenOptions, DevEnv } from '@intlify/bundle-utils'
import type { VitePluginVueI18nOptions } from './options'

const debug = createDebug('vite-plugin-vue-i18n:index')

const INTLIFY_BUNDLE_IMPORT_ID = '@intlify/vite-plugin-vue-i18n/messages'

const installedPkg = checkInstallPackage('@intlify/vite-plugin-vue-i18n', debug)
const installedVueI18nBridge = checkVueI18nBridgeInstallPackage(debug)

const VIRTUAL_PREFIX = '\0'

function getVirtualId(id: string) {
  return id.startsWith(VIRTUAL_PREFIX) ? id.slice(VIRTUAL_PREFIX.length) : null
}

function asVirtualId(id: string) {
  return VIRTUAL_PREFIX + id
}

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
  // prettier-ignore
  const compositionOnly = installedPkg === 'vue-i18n'
    ? isBoolean(options.compositionOnly)
      ? options.compositionOnly
      : true
    : true
  // prettier-ignore
  const fullInstall = installedPkg === 'vue-i18n'
    ? isBoolean(options.fullInstall)
      ? options.fullInstall
      : true
    : false
  const defaultSFCLang = isString(options.defaultSFCLang)
    ? options.defaultSFCLang
    : undefined
  const globalSFCScope = !!options.globalSFCScope
  const useVueI18nImportName = options.useVueI18nImportName
  if (useVueI18nImportName != null) {
    console.warn(
      `[vite-plugin-vue-i18n]: 'useVueI18nImportName' option is experimental`
    )
  }
  // prettier-ignore
  const getAliasName = () =>
    installedVueI18nBridge && installedPkg === 'vue-i18n'
      ? 'vue-i18n-bridge'
      : installedPkg === 'petite-vue-i18n' && isBoolean(useVueI18nImportName) &&
        useVueI18nImportName
        ? 'vue-i18n'
        : `${installedPkg}`
  const forceStringify = !!options.forceStringify

  let isProduction = false
  let sourceMap = false

  return {
    name: 'vite-plugin-vue-i18n',

    /**
     * NOTE:
     * If we have json (including SFC's custom block),
     * transform it first because it will be transformed into javascript code by `vite:json` plugin.
     */
    enforce: 'pre',

    config(config: UserConfig, { command }) {
      const aliasName = getAliasName()
      debug(`alias name: ${aliasName}`)

      if (command === 'build' && runtimeOnly) {
        normalizeConfigResolveAlias(config)
        if (isArray(config.resolve!.alias)) {
          config.resolve!.alias.push({
            find: aliasName,
            replacement: `${aliasName}/dist/${aliasName}.runtime.esm-bundler.js`
          })
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(config.resolve!.alias as any)[
            aliasName
          ] = `${aliasName}/dist/${aliasName}.runtime.esm-bundler.js`
        }
        debug(
          `set ${aliasName} runtime only: ${aliasName}/dist/${aliasName}.runtime.esm-bundler.js`
        )
      } else if (
        command === 'serve' &&
        installedPkg === 'petite-vue-i18n' &&
        useVueI18nImportName
      ) {
        normalizeConfigResolveAlias(config)
        if (isArray(config.resolve!.alias)) {
          config.resolve!.alias.push({
            find: 'vue-i18n',
            replacement: `petite-vue-i18n/dist/petite-vue-i18n.esm-bundler.js`
          })
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(config.resolve!.alias as any)[
            'vue-i18n'
          ] = `petite-vue-i18n/dist/petite-vue-i18n.esm-bundler.js`
        }
        debug(`alias name: ${aliasName}`)
      }

      config.define = config.define || {}
      config.define['__VUE_I18N_LEGACY_API__'] = !compositionOnly
      debug(
        `set __VUE_I18N_LEGACY_API__ is '${config.define['__VUE_I18N_LEGACY_API__']}'`
      )

      config.define['__VUE_I18N_FULL_INSTALL__'] = fullInstall
      debug(
        `set __VUE_I18N_FULL_INSTALL__ is '${config.define['__VUE_I18N_FULL_INSTALL__']}'`
      )

      config.define['__VUE_I18N_PROD_DEVTOOLS__'] = false
    },

    configResolved(config: ResolvedConfig) {
      isProduction = config.isProduction
      sourceMap = config.command === 'build' ? !!config.build.sourcemap : false

      // json transform handling
      const jsonPlugin = config.plugins.find(p => p.name === 'vite:json')
      if (jsonPlugin) {
        const orgTransform = jsonPlugin.transform // backup @rollup/plugin-json
        jsonPlugin.transform = async function (code: string, id: string) {
          if (!/\.json$/.test(id) || filter(id)) {
            return
          }

          /**
           * NOTE:
           * `vite:json` plugin will be handled if the query generated from the result of parse SFC
           * with `vite:vue` plugin contains json as follows.
           * e.g src/components/HelloI18n.vue?vue&type=i18n&index=1&lang.json
           *
           * To avoid this, return the result that has already been processed (`enforce: 'pre'`) in the wrapped json plugin.
           */
          const { query } = parseVueRequest(id)
          if (query.vue) {
            return
          }

          debug('org json plugin')
          return orgTransform!.apply(this, [code, id])
        }
      }
    },

    resolveId(id: string) {
      if (id === INTLIFY_BUNDLE_IMPORT_ID) {
        return asVirtualId(id)
      }
    },

    async load(id: string) {
      if (getVirtualId(id) === INTLIFY_BUNDLE_IMPORT_ID && include) {
        let resourcePaths = [] as string[]
        const includePaths = isArray(include) ? include : [include]
        for (const inc of includePaths) {
          resourcePaths = [...resourcePaths, ...(await fg(inc))]
        }
        resourcePaths = resourcePaths.filter(
          (el, pos) => resourcePaths.indexOf(el) === pos
        )
        const code = await generateBundleResources(
          resourcePaths,
          isProduction,
          forceStringify
        )
        return {
          code,
          map: { mappings: '' }
        }
      }
    },

    async handleHotUpdate({ file, server }) {
      if (/\.(json5?|ya?ml)$/.test(file)) {
        const module = server.moduleGraph.getModuleById(
          asVirtualId(INTLIFY_BUNDLE_IMPORT_ID)
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

      let langInfo = 'json'
      let inSourceMap: RawSourceMap | undefined

      if (!query.vue) {
        if (/\.(json5?|ya?ml)$/.test(id) && filter(id)) {
          langInfo = path.parse(filename).ext

          const generate = /\.?json5?/.test(langInfo)
            ? generateJSON
            : generateYAML

          const parseOptions = getOptions(
            filename,
            isProduction,
            query as Record<string, unknown>,
            sourceMap,
            inSourceMap,
            globalSFCScope,
            forceStringify
          ) as CodeGenOptions
          debug('parseOptions', parseOptions)

          const { code: generatedCode, map } = generate(code, parseOptions)
          debug('generated code', generatedCode, id)
          debug('sourcemap', map, id)

          if (code === generatedCode) return

          return {
            code: generatedCode,
            map: (sourceMap ? map : { mappings: '' }) as any // eslint-disable-line @typescript-eslint/no-explicit-any
          }
        }
      } else {
        // for Vue SFC
        if (isCustomBlock(query as Record<string, unknown>)) {
          if (isString(query.lang)) {
            langInfo = query.src
              ? query.lang === 'i18n'
                ? 'json'
                : query.lang
              : query.lang
          } else if (defaultSFCLang) {
            langInfo = defaultSFCLang
          }

          const generate = /\.?json5?/.test(langInfo)
            ? generateJSON
            : generateYAML

          const parseOptions = getOptions(
            filename,
            isProduction,
            query as Record<string, unknown>,
            sourceMap,
            inSourceMap,
            globalSFCScope,
            forceStringify
          ) as CodeGenOptions
          debug('parseOptions', parseOptions)

          const { code: generatedCode, map } = generate(code, parseOptions)
          debug('generated code', generatedCode, id)
          debug('sourcemap', map, id)

          if (code === generatedCode) return

          return {
            code: generatedCode,
            map: (sourceMap ? map : { mappings: '' }) as any // eslint-disable-line @typescript-eslint/no-explicit-any
          }
        }
      }
    }
  }
}

function normalizeConfigResolveAlias(config: UserConfig): void {
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
  sourceMap: boolean,
  inSourceMap: RawSourceMap | undefined,
  isGlobal = false,
  forceStringify = false
): Record<string, unknown> {
  const mode: DevEnv = isProduction ? 'production' : 'development'

  const baseOptions = {
    filename,
    sourceMap,
    inSourceMap,
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
      isGlobal: isGlobal || query.global != null
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
  forceStringify: boolean,
  isGlobal = false
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
        false,
        undefined,
        isGlobal,
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

export default pluginI18n
