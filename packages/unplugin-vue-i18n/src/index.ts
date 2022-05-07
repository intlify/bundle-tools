import { createUnplugin } from 'unplugin'
import { normalize, parse as parsePath } from 'pathe'
import createDebug from 'debug'
import fg from 'fast-glob'
import {
  isArray,
  isEmptyObject,
  isString,
  isNumber,
  assign
} from '@intlify/shared'
import { createFilter } from '@rollup/pluginutils'
import { generateJSON, generateYAML } from '@intlify/bundle-utils'
import { RawSourceMap } from 'source-map'
import { parse } from '@vue/compiler-sfc'
import { parseVueRequest, VueQuery } from './query'
import { createBridgeCodeGenerator } from './legacy'
import { getRaw, warn, error, raiseError } from './utils'

import type { UnpluginContextMeta, UnpluginOptions } from 'unplugin'
import type { PluginOptions } from './types'
import type { CodeGenOptions, DevEnv } from '@intlify/bundle-utils'

const INTLIFY_BUNDLE_IMPORT_ID = '@intlify/unplugin-vue-i18n/messages'
const INTLIFY_BUNDLE_IMPORT_DEPRECTED_ID =
  '@intlify/vite-plugin-vue-i18n/messages'
const debug = createDebug('unplugin-vue-i18n')

export const unplugin = createUnplugin<PluginOptions>((options = {}, meta) => {
  debug('plugin options:', options, meta.framework)

  // check bundler type
  if (!['vite', 'webpack'].includes(meta.framework)) {
    raiseError(`This plugin is supported 'vite' and 'webpack' only`)
  }

  // normalize for `options.include`
  let include = options.include
  if (include) {
    if (isArray(include)) {
      include = include.map(item => normalize(item))
    } else if (isString(include)) {
      include = normalize(include)
    }
  }

  const filter = createFilter(include)
  const forceStringify = !!options.forceStringify
  const defaultSFCLang = isString(options.defaultSFCLang)
    ? options.defaultSFCLang
    : 'json'
  const globalSFCScope = !!options.globalSFCScope
  const useClassComponent = !!options.useClassComponent
  const bridge = !!options.bridge
  debug('bridge', bridge)

  let isProduction = false
  let sourceMap = false

  return {
    name: 'unplugin-vue-i18n',

    /**
     * NOTE:
     *
     * For vite, If we have json (including SFC's custom block),
     * transform it first because it will be transformed into javascript code by `vite:json` plugin.
     *
     * For webpack, This plugin will handle with ‘post’, because vue-loader generate the request query.
     */
    enforce: meta.framework === 'vite' ? 'pre' : 'post',

    transformInclude(id) {
      debug('transformInclude', id)
      if (meta.framework === 'vite') {
        return true
      } else {
        const { filename } = parseVueRequest(id)
        return filename.endsWith('vue')
          ? true
          : /\.(json5?|ya?ml)$/.test(id) && filter(id)
      }
    },

    vite: {
      configResolved(config) {
        isProduction = config.isProduction
        sourceMap =
          config.command === 'build' ? !!config.build.sourcemap : false
        debug(
          `configResolved: isProduction = ${isProduction}, sourceMap = ${sourceMap}`
        )

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
      }
    },

    webpack(compiler) {
      isProduction = compiler.options.mode !== 'development'
      sourceMap = !!compiler.options.devtool
      debug(`webpack: isProduction = ${isProduction}, sourceMap = ${sourceMap}`)

      /**
       * NOTE:
       * After i18n resources are transformed into javascript by transform, avoid further transforming by webpack.
       */
      if (compiler.options.module) {
        compiler.options.module.rules.push({
          test: /\.(json5?|ya?ml)$/,
          type: 'javascript/auto',
          exclude: include // exclude target i18n resources
        })
      }
    },

    resolveId(id: string, importer: string) {
      debug('resolveId', id, importer)
      if (id === INTLIFY_BUNDLE_IMPORT_DEPRECTED_ID) {
        warn(
          `deprected '${INTLIFY_BUNDLE_IMPORT_DEPRECTED_ID}', you should switch to '${INTLIFY_BUNDLE_IMPORT_ID}'`
        )
        return id
      }

      if (id === INTLIFY_BUNDLE_IMPORT_ID) {
        return id
      }
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async load(id: string) {
      debug('load', id)
      const { query } = parseVueRequest(id)
      if (
        [INTLIFY_BUNDLE_IMPORT_DEPRECTED_ID, INTLIFY_BUNDLE_IMPORT_ID].includes(
          id
        ) &&
        include
      ) {
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
          query,
          isProduction,
          {
            forceStringify,
            bridge,
            useClassComponent
          }
        )
        // TODO: support virtual import identifier
        // for virtual import identifier (@intlify/unplugin-vue-i18n/messages)
        return {
          code,
          map: { mappings: '' }
        }
      }
    },

    async transform(code, id) {
      const { filename, query } = parseVueRequest(id)
      debug('transform', id, JSON.stringify(query), filename)

      let langInfo = defaultSFCLang
      let inSourceMap: RawSourceMap | undefined

      if (!query.vue) {
        if (/\.(json5?|ya?ml)$/.test(id) && filter(id)) {
          langInfo = parsePath(filename)
            .ext as Required<PluginOptions>['defaultSFCLang']

          const generate = /\.?json5?/.test(langInfo)
            ? generateJSON
            : generateYAML

          const parseOptions = getOptions(
            filename,
            isProduction,
            query as Record<string, unknown>,
            sourceMap,
            {
              inSourceMap,
              isGlobal: globalSFCScope,
              useClassComponent,
              bridge,
              forceStringify
            }
          ) as CodeGenOptions
          debug('parseOptions', parseOptions)

          const { code: generatedCode, map } = generate(
            code,
            parseOptions,
            bridge ? createBridgeCodeGenerator(code, query) : undefined
          )
          debug('generated code', generatedCode)
          debug('sourcemap', map, sourceMap)

          if (code === generatedCode) return

          return {
            code: generatedCode,
            map: (sourceMap ? map : { mappings: '' }) as any // eslint-disable-line @typescript-eslint/no-explicit-any
          }
        } else {
          // TODO: support virtual import identifier
          // for virtual import identifier (@intlify/unplugin-vue-i18n/messages)
          return {
            code,
            map: { mappings: '', version: '3', sources: [] }
          }
        }
      } else {
        // for Vue SFC
        if (isCustomBlock(query)) {
          if (isString(query.lang)) {
            langInfo = (
              query.src
                ? query.lang === 'i18n'
                  ? 'json'
                  : query.lang
                : query.lang
            ) as Required<PluginOptions>['defaultSFCLang']
          } else if (defaultSFCLang) {
            langInfo = defaultSFCLang
          }
          debug('langInfo', langInfo)

          const generate = /\.?json5?/.test(langInfo)
            ? generateJSON
            : generateYAML

          const parseOptions = getOptions(
            filename,
            isProduction,
            query as Record<string, unknown>,
            sourceMap,
            {
              inSourceMap,
              isGlobal: globalSFCScope,
              useClassComponent,
              bridge,
              forceStringify
            }
          ) as CodeGenOptions
          debug('parseOptions', parseOptions)

          const source = await getCode(
            code,
            filename,
            sourceMap,
            query,
            meta.framework
          )
          const { code: generatedCode, map } = generate(
            source,
            parseOptions,
            bridge ? createBridgeCodeGenerator(source, query) : undefined
          )
          debug('generated code', generatedCode)
          debug('sourcemap', map, sourceMap)

          if (code === generatedCode) return

          return {
            code: generatedCode,
            map: (sourceMap ? map : { mappings: '' }) as any // eslint-disable-line @typescript-eslint/no-explicit-any
          }
        }
      }
    }
  } as UnpluginOptions
})

async function generateBundleResources(
  resources: string[],
  query: VueQuery,
  isProduction: boolean,
  {
    forceStringify = false,
    isGlobal = false,
    bridge = false,
    useClassComponent = false
  }: {
    forceStringify?: boolean
    isGlobal?: boolean
    bridge?: boolean
    useClassComponent?: boolean
  }
) {
  const codes = []
  for (const res of resources) {
    debug(`${res} bundle loading ...`)

    if (/\.(json5?|ya?ml)$/.test(res)) {
      const { ext, name } = parsePath(res)
      const source = await getRaw(res)
      const generate = /json5?/.test(ext) ? generateJSON : generateYAML
      const parseOptions = getOptions(res, isProduction, {}, false, {
        isGlobal,
        useClassComponent,
        bridge,
        forceStringify
      }) as CodeGenOptions
      parseOptions.type = 'bare'
      const { code } = generate(
        source,
        parseOptions,
        bridge ? createBridgeCodeGenerator(source, query) : undefined
      )

      debug('generated code', code)
      codes.push(`${JSON.stringify(name)}: ${code}`)
    }
  }

  return `export default {
  ${codes.join(`,\n`)}
}`
}

async function getCode(
  source: string,
  filename: string,
  sourceMap: boolean,
  query: VueQuery,
  framework: UnpluginContextMeta['framework'] = 'vite'
): Promise<string> {
  const { index, issuerPath } = query
  if (!isNumber(index)) {
    raiseError(`unexpected index: ${index}`)
  }

  if (framework === 'webpack') {
    if (issuerPath) {
      // via `src=xxx` of SFC
      debug(`getCode (webpack) ${index} via issuerPath`, issuerPath)
      return await getRaw(filename)
    } else {
      const result = parse(await getRaw(filename), {
        sourceMap,
        filename
      })
      const block = result.descriptor.customBlocks[index!]
      if (block) {
        const code = block.src ? await getRaw(block.src) : block.content
        debug(`getCode (webpack) ${index} from SFC`, code)
        return code
      } else {
        return source
      }
    }
  } else {
    return source
  }
}

function isCustomBlock(query: VueQuery): boolean {
  return (
    !isEmptyObject(query) &&
    'vue' in query &&
    (query['type'] === 'custom' || // for vite (@vite-plugin-vue)
      query['type'] === 'i18n' || // for webpack (vue-loader)
      query['blockType'] === 'i18n') // for webpack (vue-loader)
  )
}

function getOptions(
  filename: string,
  isProduction: boolean,
  query: VueQuery,
  sourceMap: boolean,
  {
    inSourceMap = undefined,
    forceStringify = false,
    isGlobal = false,
    bridge = false,
    useClassComponent = false
  }: {
    inSourceMap?: RawSourceMap
    forceStringify?: boolean
    isGlobal?: boolean
    bridge?: boolean
    useClassComponent?: boolean
  }
): Record<string, unknown> {
  const mode: DevEnv = isProduction ? 'production' : 'development'

  const baseOptions = {
    filename,
    sourceMap,
    inSourceMap,
    forceStringify,
    useClassComponent,
    bridge,
    env: mode,
    onWarn: (msg: string): void => {
      warn(`${filename} ${msg}`)
    },
    onError: (msg: string): void => {
      error(`${filename} ${msg}`)
    }
  }

  if (isCustomBlock(query)) {
    return assign(baseOptions, {
      type: 'sfc',
      locale: isString(query.locale) ? query.locale : '',
      isGlobal: isGlobal || !!query.global
    })
  } else {
    return assign(baseOptions, {
      type: 'plain',
      isGlobal: false
    })
  }
}

export default unplugin

export * from './types'
