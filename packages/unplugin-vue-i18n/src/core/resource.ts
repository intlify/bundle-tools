import {
  generateJavaScript,
  generateJSON,
  generateTypescript,
  generateYAML
} from '@intlify/bundle-utils'
import {
  assign,
  generateCodeFrame,
  isArray,
  isEmptyObject,
  isNumber,
  isString
} from '@intlify/shared'
import { createFilter } from '@rollup/pluginutils'
import createDebug from 'debug'
import fg from 'fast-glob'
import { promises as fs } from 'node:fs'
import { parse as parsePath } from 'node:path'
import { normalize } from 'pathe'
import { parse } from 'vue/compiler-sfc'
import { checkVuePlugin, error, getVitePlugin, raiseError, resolveNamespace, warn } from '../utils'
import { getVueCompiler, parseVueRequest } from '../vue'

import type { CodeGenOptions, CodeGenResult, DevEnv } from '@intlify/bundle-utils'
import type { RawSourceMap } from 'source-map-js'
import type { RollupPlugin, UnpluginContextMeta, UnpluginOptions } from 'unplugin'
import type { ResolvedOptions } from '../core/options'
import type { PluginOptions } from '../types'
import type { VueQuery } from '../vue'

type ViteCompaibleModule = {
  rolldownVersion?: boolean
}

const INTLIFY_BUNDLE_IMPORT_ID = '@intlify/unplugin-vue-i18n/messages'
const VIRTUAL_PREFIX = '\0'
const RE_INTLIFY_BUNDLE_IMPORT_ID = new RegExp(`^${INTLIFY_BUNDLE_IMPORT_ID}$`)
const RE_VIRTUAL_PREFIXED_INTLIFY_BUNDLE_IMPORT_ID = new RegExp(
  `^${VIRTUAL_PREFIX}${INTLIFY_BUNDLE_IMPORT_ID}$`
)
const RE_RESOURCE_FORMAT = /\.(json5?|ya?ml|[c|m]?[j|t]s)$/
const RE_SFC_I18N_CUSTOM_BLOCK = /\?vue&type=i18n/
const RE_SFC_I18N_WEBPACK_CUSTOM_BLOCK = /blockType=i18n/

const debug = createDebug(resolveNamespace('resource'))

export function resourcePlugin(
  {
    onlyLocales,
    include,
    exclude,
    module,
    forceStringify,
    defaultSFCLang,
    globalSFCScope,
    runtimeOnly,
    dropMessageCompiler,
    compositionOnly,
    fullInstall,
    ssrBuild,
    strictMessage,
    allowDynamic,
    escapeHtml,
    transformI18nBlock
  }: ResolvedOptions,
  meta: UnpluginContextMeta
): UnpluginOptions {
  let viteModule: ViteCompaibleModule | null = null
  async function getViteModule() {
    if (viteModule != null) {
      return viteModule
    }
    try {
      viteModule = (await import('vite')) as unknown as ViteCompaibleModule
    } catch (e) {
      error(`vite not found, please install vite.`, (e as Error).message)
      throw e
    }
    return viteModule
  }

  function resolveIncludeExclude() {
    const customBlockInclude =
      meta.framework === 'vite' ? RE_SFC_I18N_CUSTOM_BLOCK : RE_SFC_I18N_WEBPACK_CUSTOM_BLOCK
    if (isArray(include)) {
      return [[...include, customBlockInclude], exclude]
    } else if (isString(include)) {
      return [[include, customBlockInclude], exclude]
    } else {
      return [[RE_RESOURCE_FORMAT, customBlockInclude], exclude]
    }
  }

  function resolveIncludeExcludeForLegacy() {
    const customBlockInclude =
      meta.framework === 'vite' ? RE_SFC_I18N_CUSTOM_BLOCK : RE_SFC_I18N_WEBPACK_CUSTOM_BLOCK
    let _include: string | (string | RegExp)[] | undefined = undefined
    let _exclude: string | (string | RegExp)[] | undefined = undefined
    if (include) {
      if (isArray(include)) {
        _include = [...include.map(item => normalize(item)), customBlockInclude]
      } else if (isString(include)) {
        _include = [normalize(include), customBlockInclude]
      }
    } else {
      _exclude = '**/**'
    }
    return [_include, _exclude]
  }

  let _filter: ReturnType<typeof createFilter> | null = null
  async function getFilter(): Promise<ReturnType<typeof createFilter>> {
    if (_filter != null) {
      return _filter
    }

    if (meta.framework == 'webpack') {
      debug('Using filter for webpack')
      _filter = createFilter(...resolveIncludeExclude())
    } else {
      const viteModule = await getViteModule()
      if (viteModule.rolldownVersion) {
        debug('Using filter for rolldown-vite')
        _filter = createFilter(...resolveIncludeExclude())
      } else {
        debug('Using filter for rollup-vite')
        _filter = createFilter(...resolveIncludeExcludeForLegacy())
      }
    }

    return _filter
  }

  const getVueI18nAliasPath = ({ ssr = false, runtimeOnly = false }) => {
    return `${module}/dist/${module}${runtimeOnly ? '.runtime' : ''}.${!ssr ? 'esm-bundler.js' /* '.mjs' */ : 'node.mjs'}`
  }

  let isProduction = false
  let sourceMap = false
  const vueI18nAliasName = module
  debug(`vue-i18n alias name: ${vueI18nAliasName}`)

  let vuePlugin: RollupPlugin | null = null
  // NOTE:
  // webpack cannot dynamically resolve vue compiler, so use the compiler statically with import syntax
  const getSfcParser = () => {
    return vuePlugin ? getVueCompiler(vuePlugin).parse : parse
  }

  return {
    name: resolveNamespace('resource'),

    /**
     * NOTE:
     *
     * For vite, If we have json (including SFC's custom block),
     * transform it first because it will be transformed into javascript code by `vite:json` plugin.
     *
     * For webpack, This plugin will handle with 'post', because vue-loader generate the request query.
     */
    enforce: meta.framework === 'vite' ? 'pre' : 'post',

    vite: {
      config() {
        const defineConfig = {
          define: {
            __VUE_I18N_LEGACY_API__: !compositionOnly,
            __VUE_I18N_FULL_INSTALL__: fullInstall,
            __INTLIFY_DROP_MESSAGE_COMPILER__: dropMessageCompiler,
            __VUE_I18N_PROD_DEVTOOLS__: false
          }
        }
        debug('define Config:', defineConfig)

        const aliasConfig = {
          resolve: {
            alias: {
              [vueI18nAliasName]: getVueI18nAliasPath({
                ssr: ssrBuild,
                runtimeOnly
              })
            }
          }
        }
        debug('alias Config:', aliasConfig)

        return assign(defineConfig, aliasConfig)
      },

      async configResolved(config) {
        vuePlugin = getVitePlugin(config, 'vite:vue')
        if (!checkVuePlugin(vuePlugin)) {
          return
        }

        isProduction = config.isProduction
        sourceMap = config.command === 'build' ? !!config.build.sourcemap : false
        debug(`configResolved: isProduction = ${isProduction}, sourceMap = ${sourceMap}`)

        // Check if we're using rolldown-vite
        const isRolldownVite = !!(await getViteModule()).rolldownVersion
        debug(`Using ${isRolldownVite ? 'rolldown-vite' : 'vite'} for the build`)

        /**
         * NOTE(kazupon):
         * For the native rolldown plugin, we need to change to another solution from the current workaround.
         * Currently, the rolldown team and vite team are discussing this issue.
         * https://github.com/vitejs/rolldown-vite/issues/120
         */

        // json transform handling for normal Vite (not rolldown-vite)
        if (!isRolldownVite) {
          const jsonPlugin = getVitePlugin(config, 'vite:json')
          if (jsonPlugin) {
            // saving `vite:json` plugin instance
            const orgTransform =
              'handler' in jsonPlugin.transform!
                ? jsonPlugin.transform!.handler
                : jsonPlugin.transform!

            // override json transform
            async function overrideJson(code: string, id: string) {
              const filter = await getFilter()
              if (!/\.json$/.test(id) || filter(id)) {
                return
              }

              /**
               * NOTE(kazupon):
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
              // @ts-expect-error
              return orgTransform.apply(this, [code, id])
            }

            /**
             * NOTE(kazupon):
             * We need to override the transform function of the `vite:json` plugin for `transform` and `transform.handler`.
             * ref: https://github.com/vitejs/vite/pull/19878/files#diff-2cfbd4f4d8c32727cd8e1a561cffbde0b384a3ce0789340440e144f9d64c10f6R1086-R1088
             */
            jsonPlugin.transform = overrideJson
            if ('handler' in jsonPlugin.transform!) {
              jsonPlugin.transform.handler = overrideJson
            }
          }
        }
      },

      async handleHotUpdate({ file, server }) {
        if (RE_RESOURCE_FORMAT.test(file)) {
          const module = server.moduleGraph.getModuleById(
            asVirtualId(INTLIFY_BUNDLE_IMPORT_ID, meta.framework)
          )
          if (module) {
            server.moduleGraph.invalidateModule(module)
            return [module!]
          }
        }
      }
    },

    webpack(compiler) {
      isProduction = compiler.options.mode !== 'development'
      sourceMap = !!compiler.options.devtool
      debug(`webpack: isProduction = ${isProduction}, sourceMap = ${sourceMap}`)

      compiler.options.resolve = normalizeConfigResolveAlias(
        compiler.options.resolve,
        meta.framework
      )
      ;(compiler.options.resolve!.alias as any)[vueI18nAliasName] = getVueI18nAliasPath({
        ssr: ssrBuild,
        runtimeOnly
      })
      debug(
        `set ${vueI18nAliasName}: ${getVueI18nAliasPath({
          ssr: ssrBuild,
          runtimeOnly
        })}`
      )

      compiler.options.plugins!.push(
        new compiler.webpack.DefinePlugin({
          __VUE_I18N_LEGACY_API__: JSON.stringify(compositionOnly),
          __VUE_I18N_FULL_INSTALL__: JSON.stringify(fullInstall),
          __INTLIFY_PROD_DEVTOOLS__: 'false'
        })
      )
      debug(`set __VUE_I18N_LEGACY_API__ is '${compositionOnly}'`)
      debug(`set __VUE_I18N_FULL_INSTALL__ is '${fullInstall}'`)

      /**
       * NOTE:
       * After i18n resources are transformed into javascript by transform, avoid further transforming by webpack.
       */
      const filter = createFilter(...resolveIncludeExclude())
      if (compiler.options.module) {
        compiler.options.module.rules.push({
          test: RE_RESOURCE_FORMAT,
          type: 'javascript/auto',
          include(resource: string) {
            debug('webpack resource include', resource)
            return filter(resource)
          }
        })
      }

      // TODO:
      //  HMR for webpack
    },

    resolveId: {
      filter: {
        id: RE_INTLIFY_BUNDLE_IMPORT_ID
      },
      handler(id: string) {
        return asVirtualId(id, meta.framework)
      }
    },

    load: {
      filter: {
        id: RE_VIRTUAL_PREFIXED_INTLIFY_BUNDLE_IMPORT_ID
      },
      async handler(id: string) {
        debug('load', id)
        if (INTLIFY_BUNDLE_IMPORT_ID === getVirtualId(id, meta.framework) && include) {
          let resourcePaths = [] as string[]
          const includePaths = isArray(include) ? include : [include]
          for (const inc of includePaths) {
            resourcePaths = [...resourcePaths, ...(await fg(inc))]
          }
          resourcePaths = resourcePaths.filter((el, pos) => resourcePaths.indexOf(el) === pos)
          const code = await generateBundleResources(resourcePaths, isProduction, {
            forceStringify,
            strictMessage,
            escapeHtml
          })
          // TODO: support virtual import identifier
          // for virtual import identifier (@intlify/unplugin-vue-i18n/messages)
          return {
            moduleType: 'js',
            code,
            map: { mappings: '' }
          }
        }
      }
    },

    transform: {
      async handler(code: string, id: string) {
        const filter = await getFilter()
        if (!filter(id)) {
          return
        }

        const { filename, query } = parseVueRequest(id)
        debug('transform', id, JSON.stringify(query), filename)

        let langInfo = defaultSFCLang
        let inSourceMap: RawSourceMap | undefined

        if (!query.vue) {
          langInfo = parsePath(filename).ext as Required<PluginOptions>['defaultSFCLang']

          const generate = getGenerator(langInfo)
          const parseOptions = getOptions(
            filename,
            isProduction,
            query as Record<string, unknown>,
            sourceMap,
            {
              inSourceMap,
              isGlobal: globalSFCScope,
              allowDynamic,
              strictMessage,
              escapeHtml,
              jit: true,
              onlyLocales,
              forceStringify
            }
          ) as CodeGenOptions
          debug('parseOptions', parseOptions)

          const { code: generatedCode, map } = await generate(code, parseOptions)
          debug('generated code', generatedCode)
          debug('sourcemap', map, sourceMap)

          if (code === generatedCode) return

          return {
            moduleType: 'js',
            code: generatedCode,
            // prettier-ignore
            map: { mappings: '' }
          }
        } else {
          // for Vue SFC
          if (isCustomBlock(query)) {
            if (isString(query.lang)) {
              langInfo = (
                query.src ? (query.lang === 'i18n' ? defaultSFCLang : query.lang) : query.lang
              ) as Required<PluginOptions>['defaultSFCLang']
            } else if (defaultSFCLang) {
              langInfo = defaultSFCLang
            }
            debug('langInfo', langInfo)

            const generate = /\.?json5?/.test(langInfo) ? generateJSON : generateYAML

            const parseOptions = getOptions(
              filename,
              isProduction,
              query as Record<string, unknown>,
              sourceMap,
              {
                inSourceMap,
                isGlobal: globalSFCScope,
                jit: true,
                strictMessage,
                escapeHtml,
                onlyLocales,
                forceStringify
              }
            ) as CodeGenOptions
            debug('parseOptions', parseOptions)

            let source = await getCode(
              code,
              filename,
              sourceMap,
              query,
              getSfcParser(),
              meta.framework
            )

            if (typeof transformI18nBlock === 'function') {
              const modifiedSource = transformI18nBlock(source)
              if (modifiedSource && typeof modifiedSource === 'string') {
                source = modifiedSource
              } else {
                warn('transformI18nBlock should return a string')
              }
            }

            const { code: generatedCode, map } = generate(source, parseOptions)
            debug('generated code', generatedCode)
            debug('sourcemap', map, sourceMap)

            if (code === generatedCode) return

            return {
              moduleType: 'js',
              code: generatedCode,
              // prettier-ignore
              map: { mappings: '' }
            }
          }
        }
      }
    }
  } satisfies UnpluginOptions
}

type GeneratorLike = (
  source: string | Buffer,
  options: CodeGenOptions
) => Promise<CodeGenResult<unknown>> | CodeGenResult<unknown>

function getGenerator(ext: string, fallback: GeneratorLike = generateJSON) {
  if (/\.?json5?$/.test(ext)) {
    return generateJSON
  }

  if (/\.ya?ml$/.test(ext)) {
    return generateYAML
  }

  if (/\.[c|m]?js$/.test(ext)) {
    return generateJavaScript
  }

  if (/\.[c|m]?ts$/.test(ext)) {
    return generateTypescript
  }

  return fallback
}

function normalizeConfigResolveAlias(
  resolve: any,
  framework: UnpluginContextMeta['framework']
): any {
  if (resolve && resolve.alias) {
    return resolve
  }

  if (!resolve) {
    if (framework === 'vite') {
      return { alias: [] }
    } else if (framework === 'webpack') {
      return { alias: {} }
    }
  } else if (!resolve.alias) {
    if (framework === 'vite') {
      resolve.alias = []
      return resolve
    } else if (framework === 'webpack') {
      resolve.alias = {}
      return resolve
    }
  }
}

async function generateBundleResources(
  resources: string[],
  isProduction: boolean,
  {
    forceStringify = false,
    isGlobal = false,
    onlyLocales = [],
    strictMessage = true,
    escapeHtml = false,
    jit = true,
    transformI18nBlock = undefined
  }: {
    forceStringify?: boolean
    isGlobal?: boolean
    onlyLocales?: string[]
    strictMessage?: boolean
    escapeHtml?: boolean
    jit?: boolean
    transformI18nBlock?: PluginOptions['transformI18nBlock']
  }
) {
  const codes = []
  for (const res of resources) {
    debug(`${res} bundle loading ...`)

    // eslint-disable-next-line regexp/no-unused-capturing-group
    if (/\.(json5?|ya?ml)$/.test(res)) {
      const { ext, name } = parsePath(res)
      const source = await getRaw(res)
      const generate = /json5?/.test(ext) ? generateJSON : generateYAML
      const parseOptions = getOptions(res, isProduction, {}, false, {
        isGlobal,
        jit,
        onlyLocales,
        strictMessage,
        escapeHtml,
        forceStringify,
        transformI18nBlock
      }) as CodeGenOptions
      parseOptions.type = 'bare'
      const { code } = generate(source, parseOptions)

      debug('generated code', code)
      codes.push(`${JSON.stringify(name)}: ${code}`)
    }
  }

  return `const isObject = (item) => item && typeof item === 'object' && !Array.isArray(item);

const mergeDeep = (target, ...sources) => {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}

export default mergeDeep({},
  ${codes.map(code => `{${code}}`).join(',\n')}
);`
}

async function getCode(
  source: string,
  filename: string,
  sourceMap: boolean,
  query: VueQuery,
  parser: ReturnType<typeof getVueCompiler>['parse'],
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
      const result = parser(await getRaw(filename), {
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
    (query['type'] === 'custom' || // for webpack (vue-loader)
      query['type'] === 'i18n' || // for vite (@vite/plugin-vue)
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
    onlyLocales = [],
    allowDynamic = false,
    strictMessage = true,
    escapeHtml = false,
    jit = true,
    transformI18nBlock = null
  }: {
    inSourceMap?: RawSourceMap
    forceStringify?: boolean
    isGlobal?: boolean
    onlyLocales?: string[]
    allowDynamic?: boolean
    strictMessage?: boolean
    escapeHtml?: boolean
    jit?: boolean
    transformI18nBlock?: PluginOptions['transformI18nBlock'] | null
  }
): Record<string, unknown> {
  const mode: DevEnv = isProduction ? 'production' : 'development'

  const baseOptions = {
    filename,
    sourceMap,
    inSourceMap,
    forceStringify,
    allowDynamic,
    strictMessage,
    escapeHtml,
    jit,
    onlyLocales,
    env: mode,
    transformI18nBlock,
    onWarn: (msg: string): void => {
      warn(`${filename} ${msg}`)
    },
    onError: (
      msg: string,
      extra?: NonNullable<Parameters<NonNullable<CodeGenOptions['onError']>>>[1]
    ): void => {
      const codeFrame = generateCodeFrame(
        extra?.source || extra?.location?.source || '',
        extra?.location?.start.column,
        extra?.location?.end.column
      )
      const errMssage = `${msg} (error code: ${extra?.code}) in ${filename}
  target message: ${extra?.source}
  target message path: ${extra?.path}

  ${codeFrame}
`
      error(errMssage)
      throw new Error(errMssage)
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

function getVirtualId(id: string, framework: UnpluginContextMeta['framework'] = 'vite') {
  // prettier-ignore
  return framework === 'vite'
    ? id.startsWith(VIRTUAL_PREFIX)
      ? id.slice(VIRTUAL_PREFIX.length)
      : ''
    : id
}

function asVirtualId(id: string, framework: UnpluginContextMeta['framework'] = 'vite') {
  return framework === 'vite' ? VIRTUAL_PREFIX + id : id
}

async function getRaw(path: string): Promise<string> {
  return fs.readFile(path, { encoding: 'utf-8' })
}
