import {
  generateJavaScript,
  generateJSON,
  generateYAML
} from '@intlify/bundle-utils'
import { assign, generateCodeFrame, isEmptyObject } from '@intlify/shared'
import { createFilter } from '@rollup/pluginutils'
import createDebug from 'debug'
import fg from 'fast-glob'
import fs from 'node:fs'
import { parse as parsePath, resolve, dirname } from 'pathe'
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
import { genImport, genSafeVariableName } from 'knitwork'
import { findStaticImports } from 'mlly'

import type { CodeGenOptions } from '@intlify/bundle-utils'
import type {
  RollupPlugin,
  UnpluginContextMeta,
  UnpluginOptions
} from 'unplugin'
import type { ResolvedOptions } from '../core/options'
import type { SFCLangFormat } from '../types'
import type { VueCompilerParser, VueQuery } from '../vue'

const INTLIFY_BUNDLE_IMPORT_ID = '@intlify/unplugin-vue-i18n/messages'
const VIRTUAL_PREFIX = '\0'

const debug = createDebug(resolveNamespace('resource'))

/**
 * Helper to handle both rspack/webpack due to similar API
 */
type WebpackLikeCompiler = Parameters<
  NonNullable<UnpluginOptions['rspack'] | UnpluginOptions['webpack']>
>[0]

type PluginCtx = {
  prod: boolean
  sourceMap: boolean
}

export function resourcePlugin(
  opts: ResolvedOptions,
  meta: UnpluginContextMeta
): UnpluginOptions {
  const _filter = createFilter(opts.include, opts.exclude)
  const importedResources = new Set<string>()
  const filter = (val: string) => _filter(val) || importedResources.has(val)

  debug(`vue-i18n alias name: ${opts.module}`)

  // updated during compiler configuration
  const ctx: PluginCtx = {
    prod: false,
    sourceMap: false
  }

  // NOTE: webpack cannot dynamically resolve vue compiler, so use the compiler statically with import syntax
  let vuePlugin: RollupPlugin | null = null
  const getSfcParser = () =>
    vuePlugin ? getVueCompiler(vuePlugin).parse : parse

  const resourcePaths = new Set<string>()
  for (const inc of opts.include || []) {
    for (const resourcePath of fg.sync(inc, { ignore: opts.exclude })) {
      resourcePaths.add(resourcePath)
    }
  }

  function result(code: string) {
    if (meta.framework === 'vite') {
      return { code, map: { mappings: '' } }
    }

    // NOTE: `map` property breaks virtuals in webpack/rspack
    return { code }
  }

  // webpack/rspack
  function sharedWebpackLikePlugin(compiler: WebpackLikeCompiler) {
    ctx.prod = compiler.options.mode !== 'development'
    ctx.sourceMap = !!compiler.options.devtool
    debug(
      `${meta.framework}: isProduction = ${ctx.prod}, sourceMap = ${ctx.sourceMap}`
    )

    compiler.options.resolve.alias = {
      ...compiler.options.resolve.alias,
      [opts.module]: opts.vueI18nAliasPath
    }
    debug(`set ${opts.module}: ${opts.vueI18nAliasPath}`)

    const loader = meta.framework === 'webpack' ? loadWebpack : loadRspack
    loader()
      .then(mod => {
        if (mod) {
          compiler.options.plugins.push(
            // @ts-expect-error type issue
            new mod.DefinePlugin({
              __VUE_I18N_FULL_INSTALL__: JSON.stringify(opts.fullInstall),
              __INTLIFY_PROD_DEVTOOLS__: 'false'
            })
          )
          debug(`set __VUE_I18N_FULL_INSTALL__ is '${opts.fullInstall}'`)
        } else {
          debug(
            `ignore vue-i18n feature flags with ${meta.framework}.DefinePlugin`
          )
        }
      })
      .catch(_e => {
        warn(`${meta.framework} not found, please install ${meta.framework}.`)
      })

    // NOTE: avoid further transformation after i18n resources have been transformed into javascript.
    compiler.options.module.rules.push({
      test: /\.(json5?|ya?ml)$/,
      type: 'javascript/auto',
      include: resource => filter(resource)
    })

    // TODO:
    //  HMR for webpack/rspack
  }

  return {
    name: resolveNamespace('resource'),

    /**
     * NOTE:
     * vite: early ('pre') transform for json and SFC's custom blocks
     * because these are transformed into javascript code by `vite:json` plugin.
     *
     * webpack/rspack: late ('post') transform because we rely on vue-loader to generate the request queries.
     */
    enforce: meta.framework === 'vite' ? 'pre' : 'post',

    rspack: sharedWebpackLikePlugin,
    webpack: sharedWebpackLikePlugin,

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
              [opts.module]: opts.vueI18nAliasPath
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

        ctx.prod = config.isProduction
        ctx.sourceMap =
          config.command === 'build' ? !!config.build.sourcemap : false
        debug(
          `configResolved: isProduction = ${ctx.prod}, sourceMap = ${ctx.sourceMap}`
        )

        // json transform handling
        const jsonPlugin = getVitePlugin(config, 'vite:json')
        if (jsonPlugin) {
          // backup @rollup/plugin-json
          const orgTransform = jsonPlugin.transform
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
      }
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

    load(id: string) {
      debug('load', id)
      if (
        INTLIFY_BUNDLE_IMPORT_ID === getVirtualId(id, meta.framework) &&
        resourcePaths.size > 0
      ) {
        const code = generateBundleResources(resourcePaths)

        // watch resources to invalidate on change (webpack)
        for (const p of resourcePaths) {
          this.addWatchFile(p)
        }

        return result(code)
      }
    },

    transformInclude(id) {
      debug('transformInclude', id)
      if (meta.framework === 'vite') {
        return true
      }

      const { filename, query } = parseVueRequest(id)

      // include imports by custom-blocks
      let isResourcePath = resourcePaths.has(id)
      if (!isResourcePath && 'issuerPath' in query) {
        isResourcePath = resourcePaths.has(query.issuerPath!)
      }

      return (
        filename.endsWith('vue') ||
        filename.endsWith(INTLIFY_BUNDLE_IMPORT_ID) ||
        (/\.(json5?|ya?ml|[c|m]?[j|t]s)$/.test(filename) &&
          filter(filename) &&
          isResourcePath)
      )
    },

    async transform(code, id) {
      const { filename, query } = parseVueRequest(id)
      debug('transform', id, JSON.stringify(query), filename)

      let langInfo = opts.defaultSFCLang

      if (filter(id)) {
        const imports = findStaticImports(code)
        for (const p of imports) {
          const res = resolve(dirname(id), p.specifier)
          importedResources.add(res)
        }
      }

      // virtual @intlify/unplugin-vue-i18n/messages
      if (
        !query.vue &&
        /\.(json5?|ya?ml|[c|m]?[j|t]s)$/.test(id) &&
        filter(id)
      ) {
        langInfo = parsePath(filename).ext as SFCLangFormat

        const generate = getGenerator(langInfo)
        const parseOptions = getOptions(filename, ctx, query, {
          ...opts,
          allowDynamic: true,
          transformI18nBlock: undefined
        })
        debug('parseOptions', parseOptions)

        const { code: generatedCode, map } = generate(code, parseOptions)
        debug('generated code', generatedCode)
        debug('sourcemap', map, ctx.sourceMap)

        if (code === generatedCode) return

        return result(generatedCode)
      }

      // for Vue SFC
      if (isCustomBlock(query)) {
        langInfo = opts.defaultSFCLang
        if (query.lang && query.lang !== 'i18n') {
          langInfo = query.lang as SFCLangFormat
        }
        debug('langInfo', langInfo)

        const parseOptions = getOptions(filename, ctx, query, {
          ...opts,
          allowDynamic: false,
          transformI18nBlock: undefined
        })
        debug('parseOptions', parseOptions)

        let source = getCode(
          code,
          filename,
          ctx.sourceMap,
          query,
          getSfcParser(),
          meta
        )

        if (typeof opts.transformI18nBlock === 'function') {
          const modifiedSource = opts.transformI18nBlock(source)
          if (modifiedSource && typeof modifiedSource === 'string') {
            source = modifiedSource
          } else {
            warn('transformI18nBlock should return a string')
          }
        }

        const generate = getGenerator(langInfo, generateYAML)
        const { code: generatedCode, map } = generate(source, parseOptions)
        debug('generated code', generatedCode)
        debug('sourcemap', map, ctx.sourceMap)

        if (code !== generatedCode) {
          return result(generatedCode)
        }
      }
    }
  } as UnpluginOptions
}

type GeneratorFn =
  | typeof generateJSON
  | typeof generateJavaScript
  | typeof generateYAML
function getGenerator(ext: string, fallback: GeneratorFn = generateJSON) {
  if (/\.?json5?$/.test(ext)) {
    return generateJSON
  }

  if (/\.ya?ml$/.test(ext)) {
    return generateYAML
  }

  if (/\.[c|m]?[j|t]s$/.test(ext)) {
    return generateJavaScript
  }

  return fallback
}

async function loadWebpack() {
  const mod = await import('webpack')
  return mod.default || mod
}

async function loadRspack() {
  const { rspack } = await import('@rspack/core')
  return rspack
}

function generateBundleResources(resources: Set<string>) {
  const codes = []
  const imports: { statement: string; varName: string }[] = []
  for (const filename of resources) {
    debug(`${filename} bundle loading ...`)
    const { name } = parsePath(filename)
    const varName = genSafeVariableName(filename)
    imports.push({ statement: genImport(filename, varName), varName })
    codes.push(`${JSON.stringify(name)}: ${varName}`)
  }

  const importStatements = imports.map(x => x.statement).join('\n')

  return `
${importStatements}

const isObject = (item) => item && typeof item === 'object' && !Array.isArray(item);

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

function getCode(
  source: string,
  filename: string,
  sourceMap: boolean,
  query: VueQuery,
  parser: VueCompilerParser,
  meta: UnpluginContextMeta
): string {
  if (query.index == null) {
    raiseError(`unexpected index: ${query.index}`)
  }

  if (meta.framework === 'vite') {
    return source
  }

  // via `src=xxx` of SFC
  if (query.issuerPath) {
    debug(
      `getCode (${meta.framework}) ${query.index} via issuerPath`,
      query.issuerPath
    )
    return readFile(filename)
  }

  const result = parser(readFile(filename), { sourceMap, filename })
  const block = result.descriptor.customBlocks[query.index!]
  if (block) {
    const code = block.src ? readFile(block.src) : block.content
    debug(`getCode (${meta.framework}) ${query.index} from SFC`, code)
    return code
  }

  return source
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
  ctx: PluginCtx,
  query: VueQuery,
  opts: CodeGenOptions & Pick<ResolvedOptions, 'globalSFCScope'>
): CodeGenOptions {
  const baseOptions: CodeGenOptions = {
    ...opts,
    filename,
    jit: true,
    // allow overriding ctx.sourceMap with opts
    sourceMap: opts.sourceMap ?? ctx.sourceMap,
    env: ctx.prod ? 'production' : 'development',
    onWarn: msg => warn(`${filename} ${msg}`),
    onError: (msg, extra) => {
      const codeFrame = generateCodeFrame(
        extra?.source || extra?.location?.source || '',
        extra?.location?.start.column,
        extra?.location?.end.column
      )
      const errMessage = `${msg} (error code: ${extra?.code}) in ${filename}
  target message: ${extra?.source}
  target message path: ${extra?.path}

  ${codeFrame}
`
      error(errMessage)
      throw new Error(errMessage)
    }
  }

  if (isCustomBlock(query)) {
    return assign(baseOptions, {
      type: 'sfc' as const,
      locale: query.locale ?? '',
      isGlobal: opts.globalSFCScope || !!query.global
    })
  }

  return assign(baseOptions, {
    type: 'plain' as const,
    isGlobal: false
  })
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

function readFile(path: string): string {
  return fs.readFileSync(path, 'utf-8')
}
