import {
  generateJavaScript,
  generateJSON,
  generateTypescript,
  generateYAML
} from '@intlify/bundle-utils'
import { assign, generateCodeFrame, isEmptyObject, isNumber, isString } from '@intlify/shared'
import { createFilter } from '@rollup/pluginutils'
import createDebug from 'debug'
import { promises as fs } from 'node:fs'
import { dirname, normalize, parse as parsePath, relative, resolve } from 'pathe'
import { glob } from 'tinyglobby'
import { parse } from 'vue/compiler-sfc'
import { checkVuePlugin, error, getVitePlugin, raiseError, resolveNamespace, warn } from '../utils'
import { getVueCompiler, parseVueRequest } from '../vue'

import type { CodeGenOptions, CodeGenResult, DevEnv } from '@intlify/bundle-utils'
import type { RawSourceMap } from 'source-map-js'
import type { RollupPlugin, UnpluginContextMeta, UnpluginOptions } from 'unplugin'
import type { ResolvedOptions } from '../core/options'
import type { PluginOptions } from '../types'
import type { VueQuery } from '../vue'

const INTLIFY_BUNDLE_IMPORT_ID = '@intlify/unplugin-vue-i18n/messages'
// Use `virtual:` instead of Rollup's `\0` prefix — NUL bytes break WinAPI on Windows.
// ref: https://github.com/intlify/bundle-tools/issues/595
const VIRTUAL_PREFIX = 'virtual:'
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
  meta: UnpluginContextMeta,
  collector?: import('./collector').UsedKeysCollector | null
): UnpluginOptions {
  function resolveIncludeExclude() {
    const customBlockInclude =
      meta.framework === 'vite' ? RE_SFC_I18N_CUSTOM_BLOCK : RE_SFC_I18N_WEBPACK_CUSTOM_BLOCK
    return include
      ? [[...include, customBlockInclude], exclude]
      : [[RE_RESOURCE_FORMAT, customBlockInclude], exclude]
  }

  function resolveIncludeExcludeForLegacy() {
    const customBlockInclude =
      meta.framework === 'vite' ? RE_SFC_I18N_CUSTOM_BLOCK : RE_SFC_I18N_WEBPACK_CUSTOM_BLOCK
    // pass `exclude` through as the other path does; leaving it out let Vite 6 / 7 compile
    // excluded files anyway
    // prettier-ignore
    return include
      ? [[...include, customBlockInclude], exclude]
      : [undefined, ['**/**']]
  }

  let _filter: ReturnType<typeof createFilter> | null = null
  async function getFilter(): Promise<ReturnType<typeof createFilter>> {
    if (_filter != null) {
      return _filter
    }

    if (meta.framework == 'webpack') {
      debug('Using filter for webpack')
      _filter = createFilter(...resolveIncludeExclude())
    } else if (hasViteJsonPlugin) {
      debug('Using filter for rollup-vite')
      _filter = createFilter(...resolveIncludeExcludeForLegacy())
    } else {
      debug('Using filter for rolldown-vite')
      _filter = createFilter(...resolveIncludeExclude())
    }

    return _filter
  }

  const getVueI18nAliasPath = ({ ssr = false, runtimeOnly = false }) => {
    return `${module}/dist/${module}${runtimeOnly ? '.runtime' : ''}.${!ssr ? 'esm-bundler.js' /* '.mjs' */ : 'node.mjs'}`
  }

  let isProduction = false
  let sourceMap = false
  let hasViteJsonPlugin = false
  let warnedScriptResources = false
  const vueI18nAliasName = module
  debug(`vue-i18n alias name: ${vueI18nAliasName}`)

  let vuePlugin: RollupPlugin | null = null
  // NOTE:
  // webpack cannot dynamically resolve vue compiler, so use the compiler statically with import syntax
  const getSfcParser = () => {
    return vuePlugin ? getVueCompiler(vuePlugin).parse : parse
  }

  /**
   * vite 8 (rolldown) ships `builtin:vite-json`, which reads `.json` / `.json5`
   * files as JSON. Our `enforce: 'pre'` transform compiles a locale resource to
   * JS and returns `moduleType: 'js'` (see `result()`), which tells rolldown the
   * module is JavaScript, so `builtin:vite-json` leaves it alone. JSON / JSON5
   * resources and SFC `lang.json` / `lang.json5` blocks therefore go through
   * `transform` like YAML / JS / TS, with no virtual ids.
   */

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

        /**
         * NOTE(kazupon):
         * Override `vite:json` plugin transform to prevent it from processing
         * JSON files that unplugin-vue-i18n has already compiled.
         *
         * We detect the builder by checking whether `vite:json` exists in
         * `config.plugins` — rolldown-based Vite (v8+) uses
         * `builtin:vite-json` instead, so `getVitePlugin` returns null and
         * this block is naturally skipped. This is more reliable than
         * `import('vite').rolldownVersion` which can resolve to the wrong
         * copy in multi-vite setups (e.g. Nuxt 4 + UnoCSS).
         * ref: https://github.com/intlify/bundle-tools/issues/553
         */
        const jsonPlugin = getVitePlugin(config, 'vite:json')
        hasViteJsonPlugin = !!jsonPlugin
        if (jsonPlugin && jsonPlugin.transform) {
          const transform = jsonPlugin.transform
          const isObjectHook = typeof transform !== 'function' && 'handler' in transform
          const orgTransform = isObjectHook ? transform.handler : transform

          async function overrideJson(this: unknown, code: string, id: string) {
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

          if (isObjectHook) {
            transform.handler = overrideJson as typeof transform.handler
          } else {
            jsonPlugin.transform = overrideJson as typeof jsonPlugin.transform
          }
        }
      },

      handleHotUpdate({ file, modules, server }) {
        // JSON resources are normal modules now (no virtual ids), so vite handles their HMR.
        // Only the `messages` bundle still needs a nudge: invalidate it when an included file changes.
        const key = normalize(file)
        if (!(include && createFilter(include, exclude)(key))) return

        const affected = new Set(modules)
        const mod = server.moduleGraph.getModuleById(
          asVirtualId(INTLIFY_BUNDLE_IMPORT_ID, meta.framework)
        )
        if (mod) affected.add(mod)

        if (affected.size === modules.length) return
        return [...affected]
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
      async handler(id: string) {
        if (id === INTLIFY_BUNDLE_IMPORT_ID) {
          return asVirtualId(id, meta.framework)
        }
        // JSON / JSON5 resources keep their real ids on vite 8 now; `transform` compiles them and
        // returns `moduleType: 'js'` so `builtin:vite-json` does not re-read them (see `result()`).
      }
    },

    loadInclude(id: string) {
      return INTLIFY_BUNDLE_IMPORT_ID === getVirtualId(id, meta.framework)
    },

    load: {
      async handler(id: string) {
        debug('load', id)
        if (INTLIFY_BUNDLE_IMPORT_ID === getVirtualId(id, meta.framework) && include) {
          let resourcePaths = [] as string[]
          for (const inc of include) {
            // tinyglobby 0.2.16 takes its default `cwd` on import, so pass the current one. Leave
            // out what `exclude` matches, as the transform filter does
            resourcePaths = [
              ...resourcePaths,
              ...(await glob(inc, {
                cwd: process.cwd(),
                expandDirectories: false,
                absolute: true,
                ignore: exclude
              }))
            ]
          }
          resourcePaths = resourcePaths.filter((el, pos) => resourcePaths.indexOf(el) === pos)
          // This bundle takes only JSON / YAML resources on v11, so JS / TS files under `include`
          // are left out of it. Say so once, rather than leaving them out without a word (#503)
          if (!warnedScriptResources) {
            const scripts = resourcePaths.filter(path => /\.[cm]?[jt]s$/.test(path)).sort()
            if (scripts.length > 0) {
              warnedScriptResources = true
              const listed = scripts.slice(0, 10).map(path => relative(process.cwd(), path))
              const more =
                scripts.length > listed.length ? `, and ${scripts.length - listed.length} more` : ''
              warn(
                `JS / TS files under \`include\` are not bundled into \`${INTLIFY_BUNDLE_IMPORT_ID}\` (v11 bundles JSON / YAML only): ${listed.join(', ')}${more}. Import them directly, or collect them with \`import.meta.glob\`.`
              )
            }
          }
          const code = await generateBundleResources(resourcePaths, isProduction, {
            forceStringify,
            strictMessage,
            escapeHtml,
            usedKeyFilter: collector
              ? (keyPath: string) => collector.shouldKeepKey(keyPath)
              : undefined
          })
          // TODO: support virtual import identifier
          // for virtual import identifier (@intlify/unplugin-vue-i18n/messages)
          // webpack takes `map` as the source map of the module, and an empty one without `sources`
          // breaks the source maps of the bundle
          if (meta.framework !== 'vite') {
            return { code }
          }
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

        // Compile a resource only when the id itself ends in a resource extension. A `?raw` / `?url`
        // (or other query) import keeps its real suffix off the end, so it is left to vite — otherwise
        // the generator would try to parse the raw text / url as YAML/JSON (#505).
        if (!query.vue && RE_RESOURCE_FORMAT.test(id)) {
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
              forceStringify,
              usedKeyFilter: collector
                ? (keyPath: string) => collector.shouldKeepKey(keyPath)
                : undefined
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

            const generate = getGenerator(langInfo, generateYAML)

            // For SFC custom blocks, only apply tree-shaking filter for global scope
            const isGlobalBlock = globalSFCScope || !!query.global
            const parseOptions = getOptions(
              filename,
              isProduction,
              query as Record<string, unknown>,
              sourceMap,
              {
                inSourceMap,
                isGlobal: globalSFCScope,
                allowDynamic,
                jit: true,
                strictMessage,
                escapeHtml,
                onlyLocales,
                forceStringify,
                usedKeyFilter:
                  collector && isGlobalBlock
                    ? (keyPath: string) => collector.shouldKeepKey(keyPath)
                    : undefined
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

            // For JS/TS custom blocks, wrap source with `export default`
            // since the JS/TS generators require it
            if (/\.?[cm]?[jt]s$/.test(langInfo)) {
              source = `export default ${source.replace(/^[\s;]+/, '')}`
            }

            const { code: generatedCode, map } = await generate(source, parseOptions)
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

  if (/\.?ya?ml$/.test(ext)) {
    return generateYAML
  }

  if (/\.?[cm]?js$/.test(ext)) {
    return generateJavaScript
  }

  if (/\.?[cm]?ts$/.test(ext)) {
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
    transformI18nBlock = undefined,
    usedKeyFilter = undefined
  }: {
    forceStringify?: boolean
    isGlobal?: boolean
    onlyLocales?: string[]
    strictMessage?: boolean
    escapeHtml?: boolean
    jit?: boolean
    transformI18nBlock?: PluginOptions['transformI18nBlock']
    usedKeyFilter?: ((keyPath: string) => boolean) | undefined
  }
) {
  const codes = []
  for (const res of resources) {
    debug(`${res} bundle loading ...`)

    // eslint-disable-next-line regexp/no-unused-capturing-group -- ignore
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
        transformI18nBlock,
        usedKeyFilter
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
        const code = block.src ? await getRaw(resolveBlockSrc(block.src, filename)) : block.content
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
    transformI18nBlock = null,
    usedKeyFilter = undefined
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
    usedKeyFilter?: ((keyPath: string) => boolean) | undefined
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
    usedKeyFilter,
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

function resolveBlockSrc(src: string, sfcFilename: string): string {
  if (src.startsWith('.') || (!src.startsWith('/') && !/^[a-z]:[/\\]/i.test(src))) {
    return resolve(dirname(sfcFilename), src)
  }
  return src
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
