import {
  generateJavaScript,
  generateJSON,
  generateYAML
} from '@intlify/bundle-utils'
import {
  assign,
  generateCodeFrame,
  isEmptyObject,
  isNumber,
  isString
} from '@intlify/shared'
import { createFilter } from '@rollup/pluginutils'
import createDebug from 'debug'
import fg from 'fast-glob'
import { promises as fs } from 'node:fs'
import { parse as parsePath } from 'pathe'
import { parse } from 'vue/compiler-sfc'
import {
  checkVuePlugin,
  error,
  getVitePlugin,
  raiseError,
  resolveNamespace,
  warn
} from '../utils'
import { getVueCompiler, parseVueRequest } from '../vue'

import type { CodeGenOptions, DevEnv } from '@intlify/bundle-utils'
import type { RawSourceMap } from 'source-map-js'
import type {
  RollupPlugin,
  TransformResult,
  UnpluginContextMeta,
  UnpluginOptions
} from 'unplugin'
import type { ResolvedOptions } from '../core/options'
import type { PluginOptions } from '../types'
import type { VueQuery } from '../vue'

const INTLIFY_BUNDLE_IMPORT_ID = '@intlify/unplugin-vue-i18n/messages'
const VIRTUAL_PREFIX = '\0'

const debug = createDebug(resolveNamespace('resource'))

export function resourcePlugin(
  opts: ResolvedOptions,
  meta: UnpluginContextMeta
): UnpluginOptions {
  const vueI18nAliasPath = getVueI18nAliasPath(opts)
  const filter = createFilter(opts.include, opts.exclude)

  debug(`vue-i18n alias name: ${opts.module}`)

  let isProduction = false
  let sourceMap = false

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
     * For webpack, This plugin will handle with ‘post’, because vue-loader generate the request query.
     */
    enforce: meta.framework === 'vite' ? 'pre' : 'post',

    vite: {
      config() {
        const defineConfig = {
          define: {
            __VUE_I18N_FULL_INSTALL__: opts.fullInstall,
            __INTLIFY_DROP_MESSAGE_COMPILER__: opts.dropMessageCompiler,
            __VUE_I18N_PROD_DEVTOOLS__: false
          }
        }
        debug('define Config:', defineConfig)

        const aliasConfig = {
          resolve: {
            alias: {
              [opts.module]: vueI18nAliasPath
            }
          }
        }
        debug('alias Config:', aliasConfig)

        return assign(defineConfig, aliasConfig)
      },

      configResolved(config) {
        vuePlugin = getVitePlugin(config, 'vite:vue')
        if (!checkVuePlugin(vuePlugin)) {
          return
        }

        isProduction = config.isProduction
        sourceMap =
          config.command === 'build' ? !!config.build.sourcemap : false
        debug(
          `configResolved: isProduction = ${isProduction}, sourceMap = ${sourceMap}`
        )

        // json transform handling
        const jsonPlugin = getVitePlugin(config, 'vite:json')
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
            // @ts-expect-error
            return orgTransform!.apply(this, [code, id])
          }
        }

        /**
         * typescript transform handling
         *
         * NOTE:
         *  Typescript resources are handled using the already existing `vite:esbuild` plugin.
         */
        const esbuildPlugin = getVitePlugin(config, 'vite:esbuild')
        if (esbuildPlugin) {
          const orgTransform = esbuildPlugin.transform // backup @rollup/plugin-json
          // @ts-ignore
          esbuildPlugin.transform = async function (code: string, id: string) {
            // @ts-expect-error
            const result = (await orgTransform!.apply(this, [
              code,
              id
            ])) as TransformResult
            if (result == null) {
              return result
            }

            const { filename, query } = parseVueRequest(id)
            if (!query.vue && filter(id) && /\.[c|m]?ts$/.test(id)) {
              const [_code, inSourceMap]: [string, RawSourceMap | undefined] =
                isString(result)
                  ? [result, undefined]
                  : [result.code, result.map as RawSourceMap]

              let langInfo = opts.defaultSFCLang
              langInfo = parsePath(filename)
                .ext as Required<PluginOptions>['defaultSFCLang']

              const generate = getGenerator(langInfo)
              const parseOptions = getOptions(
                filename,
                isProduction,
                query as Record<string, unknown>,
                sourceMap,
                { ...opts, jit: true, inSourceMap, transformI18nBlock: null }
              ) as CodeGenOptions
              debug('parseOptions', parseOptions)

              const { code: generatedCode, map } = generate(_code, parseOptions)
              debug('generated code', generatedCode)
              debug('sourcemap', map, sourceMap)

              if (_code === generatedCode) return

              return {
                code: generatedCode,
                map: { mappings: '' }
              }
            } else {
              return result
            }
          }
        }
      },

      async handleHotUpdate({ file, server }) {
        if (/\.(json5?|ya?ml)$/.test(file)) {
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
      webpackLike(compiler, { ...opts, meta, vueI18nAliasPath, filter })
    },

    rspack(compiler) {
      webpackLike(compiler, { ...opts, meta, vueI18nAliasPath, filter })
    },

    resolveId(id: string, importer: string) {
      debug('resolveId', id, importer)
      if (id === INTLIFY_BUNDLE_IMPORT_ID) {
        return asVirtualId(id, meta.framework)
      }
    },

    loadInclude(id: string) {
      return INTLIFY_BUNDLE_IMPORT_ID === getVirtualId(id, meta.framework)
    },

    async load(id: string) {
      debug('load', id)
      if (
        INTLIFY_BUNDLE_IMPORT_ID === getVirtualId(id, meta.framework) &&
        opts.include
      ) {
        let resourcePaths = [] as string[]
        const includePaths = toArray(opts.include)
        for (const inc of includePaths) {
          resourcePaths = [...resourcePaths, ...(await fg(inc))]
        }
        resourcePaths = resourcePaths.filter(
          (el, pos) => resourcePaths.indexOf(el) === pos
        )
        const code = await generateBundleResources(
          resourcePaths,
          isProduction,
          opts
        )
        // TODO: support virtual import identifier
        // for virtual import identifier (@intlify/unplugin-vue-i18n/messages)
        return {
          code,
          map: { mappings: '' }
        }
      }
    },

    transformInclude(id) {
      debug('transformInclude', id)
      if (meta.framework === 'vite') {
        return true
      } else {
        const { filename } = parseVueRequest(id)
        return (
          filename.endsWith('vue') ||
          filename.endsWith(INTLIFY_BUNDLE_IMPORT_ID) ||
          (/\.(json5?|ya?ml)$/.test(filename) && filter(filename))
        )
      }
    },

    async transform(code, id) {
      const { filename, query } = parseVueRequest(id)
      debug('transform', id, JSON.stringify(query), filename)

      let langInfo = opts.defaultSFCLang
      let inSourceMap: RawSourceMap | undefined

      if (!query.vue) {
        if (/\.(json5?|ya?ml|[c|m]?js)$/.test(id) && filter(id)) {
          langInfo = parsePath(filename)
            .ext as Required<PluginOptions>['defaultSFCLang']

          const generate = getGenerator(langInfo)
          const parseOptions = getOptions(
            filename,
            isProduction,
            query as Record<string, unknown>,
            sourceMap,
            { ...opts, inSourceMap, jit: true, transformI18nBlock: null }
          ) as CodeGenOptions
          debug('parseOptions', parseOptions)

          const { code: generatedCode, map } = generate(code, parseOptions)
          debug('generated code', generatedCode)
          debug('sourcemap', map, sourceMap)

          if (code === generatedCode) return

          return {
            code: generatedCode,
            // prettier-ignore
            map: { mappings: '' }
          }
        } else {
          // TODO: support virtual import identifier
          // for virtual import identifier (@intlify/unplugin-vue-i18n/messages)
        }
      } else {
        // for Vue SFC
        if (isCustomBlock(query)) {
          if (isString(query.lang)) {
            langInfo = (
              query.src
                ? query.lang === 'i18n'
                  ? opts.defaultSFCLang
                  : query.lang
                : query.lang
            ) as Required<PluginOptions>['defaultSFCLang']
          } else if (opts.defaultSFCLang) {
            langInfo = opts.defaultSFCLang
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
              ...opts,
              jit: true,
              inSourceMap,
              allowDynamic: false,
              transformI18nBlock: null
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

          if (typeof opts.transformI18nBlock === 'function') {
            const modifiedSource = opts.transformI18nBlock(source)
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
            code: generatedCode,
            // prettier-ignore
            map: { mappings: '' }
          }
        }
      }
    }
  } as UnpluginOptions
}

function getGenerator(ext: string, defaultGen = generateJSON) {
  // prettier-ignore
  return /\.?json5?$/.test(ext)
    ? generateJSON
    : /\.ya?ml$/.test(ext)
      ? generateYAML
      : /\.([c|m]?js|[c|m]?ts)$/.test(ext)
        ? generateJavaScript
        : defaultGen
}

/**
 * Creates a path to the correct vue-i18n build used as alias (e.g. `vue-i18n/dist/vue-i18n.runtime.node.js`)
 */
const getVueI18nAliasPath = (opts: ResolvedOptions) => {
  const runtime = opts.runtimeOnly ? 'runtime' : ''
  const format = !opts.ssrBuild ? 'esm-bundler' : 'node'

  const filename = [opts.module, runtime, format, 'js']
    .filter(Boolean)
    .join('.')

  return `${opts.module}/dist/${filename}`
}

function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

function webpackLike(
  compiler:
    | Parameters<NonNullable<UnpluginOptions['rspack']>>[0]
    | Parameters<NonNullable<UnpluginOptions['webpack']>>[0],
  opts: Pick<ResolvedOptions, 'fullInstall' | 'module'> & {
    meta: UnpluginContextMeta
    vueI18nAliasPath: string
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    filter: (id: string | unknown) => boolean
  }
) {
  debug(
    `${opts.meta.framework}: isProduction = ${compiler.options.mode !== 'development'}, sourceMap = ${!!compiler.options.devtool}`
  )

  compiler.options.resolve.alias ||= {}
  ;(compiler.options.resolve.alias as any)[opts.module] = opts.vueI18nAliasPath

  debug(`set ${opts.module}: ${opts.vueI18nAliasPath}`)

  const loader = opts.meta.framework === 'webpack' ? loadWebpack : loadRspack
  loader().then(mod => {
    if (mod) {
      compiler.options.plugins!.push(
        // @ts-expect-error type issue
        new mod.DefinePlugin({
          __VUE_I18N_FULL_INSTALL__: JSON.stringify(opts.fullInstall),
          __INTLIFY_PROD_DEVTOOLS__: 'false'
        })
      )
      debug(`set __VUE_I18N_FULL_INSTALL__ is '${opts.fullInstall}'`)
    } else {
      debug(
        `ignore vue-i18n feature flags with ${opts.meta.framework}.DefinePlugin`
      )
    }
  })

  /**
   * NOTE:
   * After i18n resources are transformed into javascript by transform, avoid further transforming by webpack.
   */
  if (compiler.options.module) {
    compiler.options.module.rules.push({
      test: /\.(json5?|ya?ml)$/,
      type: 'javascript/auto',
      include(resource: string) {
        return opts.filter(resource)
      }
    })
  }

  // TODO:
  //  HMR for webpack
}

async function loadWebpack() {
  try {
    const mod = await import('webpack')
    return mod.default || mod
  } catch (_e) {
    warn(`webpack not found, please install webpack.`)
  }
  return null
}

async function loadRspack() {
  try {
    const { rspack } = await import('@rspack/core')
    return rspack
  } catch (_e) {
    warn(`rspack not found, please install rspack.`)
  }
  return null
}

async function generateBundleResources(
  resources: string[],
  isProduction: boolean,
  opts: Pick<ResolvedOptions, 'forceStringify' | 'strictMessage' | 'escapeHtml'>
) {
  const codes = []
  for (const res of resources) {
    debug(`${res} bundle loading ...`)

    if (/\.(json5?|ya?ml)$/.test(res)) {
      const { ext, name } = parsePath(res)
      const source = await getRaw(res)
      const generate = /json5?/.test(ext) ? generateJSON : generateYAML
      const parseOptions = getOptions(res, isProduction, {}, false, {
        ...opts,
        jit: true,
        inSourceMap: undefined,
        onlyLocales: [],
        allowDynamic: false,
        globalSFCScope: false,
        transformI18nBlock: null
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

  if (framework === 'webpack' || framework === 'rspack') {
    if (issuerPath) {
      // via `src=xxx` of SFC
      debug(`getCode (${framework}) ${index} via issuerPath`, issuerPath)
      return await getRaw(filename)
    } else {
      const result = parser(await getRaw(filename), {
        sourceMap,
        filename
      })
      const block = result.descriptor.customBlocks[index!]
      if (block) {
        const code = block.src ? await getRaw(block.src) : block.content
        debug(`getCode (${framework}) ${index} from SFC`, code)
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
    jit,
    transformI18nBlock,
    ...opts
  }: Pick<
    ResolvedOptions,
    | 'globalSFCScope'
    | 'strictMessage'
    | 'allowDynamic'
    | 'escapeHtml'
    | 'onlyLocales'
    | 'forceStringify'
    | 'transformI18nBlock'
  > & { inSourceMap: RawSourceMap | undefined; jit: boolean }
): Record<string, unknown> {
  const mode: DevEnv = isProduction ? 'production' : 'development'

  const baseOptions = {
    ...opts,
    filename,
    sourceMap,
    jit,
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
      isGlobal: opts.globalSFCScope || !!query.global
    })
  } else {
    return assign(baseOptions, {
      type: 'plain',
      isGlobal: false
    })
  }
}

function getVirtualId(
  id: string,
  framework: UnpluginContextMeta['framework'] = 'vite'
) {
  // prettier-ignore
  return framework === 'vite'
    ? id.startsWith(VIRTUAL_PREFIX)
      ? id.slice(VIRTUAL_PREFIX.length)
      : ''
    : id
}

function asVirtualId(
  id: string,
  framework: UnpluginContextMeta['framework'] = 'vite'
) {
  return framework === 'vite' ? VIRTUAL_PREFIX + id : id
}

async function getRaw(path: string): Promise<string> {
  return fs.readFile(path, { encoding: 'utf-8' })
}
