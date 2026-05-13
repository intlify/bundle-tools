import {
  DynamicResourceError,
  generateJavaScript,
  generateJSON,
  generateTypescript,
  generateYAML
} from '@intlify/bundle-utils'
import { assign, generateCodeFrame, isEmptyObject } from '@intlify/shared'
import { createFilter } from '@rollup/pluginutils'
import createDebug from 'debug'
import { genImport, genSafeVariableName } from 'knitwork'
import { findStaticImports } from 'mlly'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { dirname, parse as parsePath, resolve } from 'node:path'
import { globSync } from 'tinyglobby'
import { parse } from 'vue/compiler-sfc'
import { checkVuePlugin, error, getVitePlugin, raiseError, resolveNamespace, warn } from '../utils'
import { getVueCompiler, parseVueRequest } from '../vue'

import type { CodeGenOptions, CodeGenResult } from '@intlify/bundle-utils'
import type { RollupPlugin, UnpluginContextMeta, UnpluginOptions } from 'unplugin'
import type { ResolvedOptions } from '../core/options'
import type { SFCLangFormat } from '../types'
import type { VueCompilerParser, VueQuery } from '../vue'

const INTLIFY_BUNDLE_IMPORT_ID = '@intlify/unplugin-vue-i18n/messages'
const VIRTUAL_PREFIX = '\0'

const supportedFileExtensionsRE = /\.(json5?|ya?ml|[c|m]?[j|t]s)$/
const RE_SFC_I18N_CUSTOM_BLOCK = /\?vue&type=i18n/
const RE_SFC_I18N_WEBPACK_CUSTOM_BLOCK = /blockType=i18n/

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

export function resourcePlugin(opts: ResolvedOptions, meta: UnpluginContextMeta): UnpluginOptions {
  const importedResources = new Set<string>()

  /**
   * Build (include, exclude) for `createFilter` in the rolldown-vite / webpack / rspack path.
   * - When the user specifies `include`, append the SFC custom-block matcher and pass through `exclude`.
   * - When the user does not specify `include`, fall back to extension-based matching.
   *
   * Note: `opts.exclude` becomes `['**\/**']` when no include is set (legacy behavior baked into
   * `core/options.ts`). For the rolldown path that quirk is undesirable, so we deliberately drop
   * exclude here.
   */
  function resolveIncludeExclude(): Parameters<typeof createFilter> {
    const customBlockInclude =
      meta.framework === 'vite' ? RE_SFC_I18N_CUSTOM_BLOCK : RE_SFC_I18N_WEBPACK_CUSTOM_BLOCK
    return opts.include
      ? [[...opts.include, customBlockInclude], opts.exclude]
      : [[supportedFileExtensionsRE, customBlockInclude], undefined]
  }

  /**
   * Build (include, exclude) for `createFilter` in the rollup-vite (legacy) path.
   * Preserves the historical behavior where omitting `include` means "exclude everything"
   * (driven by `opts.exclude === ['**\/**']`).
   */
  function resolveIncludeExcludeForLegacy(): Parameters<typeof createFilter> {
    const customBlockInclude =
      meta.framework === 'vite' ? RE_SFC_I18N_CUSTOM_BLOCK : RE_SFC_I18N_WEBPACK_CUSTOM_BLOCK
    return opts.include
      ? [[...opts.include, customBlockInclude], opts.exclude]
      : [undefined, opts.exclude]
  }

  let _filter: ReturnType<typeof createFilter> | null = null
  let hasViteJsonPlugin = false

  /**
   * Lazily resolves the active filter based on the bundler in use.
   * - webpack / rspack: regex-based filter (eagerly seeded by `sharedWebpackLikePlugin`).
   * - vite with `vite:json` plugin (rollup-vite): legacy include/exclude path.
   * - vite without `vite:json` plugin (rolldown-vite, v8+): regex-based filter.
   *
   * The returned wrapper composes `importedResources` so files discovered via
   * static-import scanning continue to pass.
   */
  async function getFilter(): Promise<(val: string) => boolean> {
    if (_filter == null) {
      if (meta.framework === 'webpack' || meta.framework === 'rspack') {
        debug('Using filter for webpack/rspack')
        _filter = createFilter(...resolveIncludeExclude())
      } else if (hasViteJsonPlugin) {
        debug('Using filter for rollup-vite')
        _filter = createFilter(...resolveIncludeExcludeForLegacy())
      } else {
        debug('Using filter for rolldown-vite')
        _filter = createFilter(...resolveIncludeExclude())
      }
    }
    return (val: string) => _filter!(val) || importedResources.has(val)
  }

  /**
   * Virtual id machinery for vite 8+ (rolldown-based) builds.
   *
   * vite 8 ships `builtin:vite-json` as a Rust plugin whose `transform` cannot
   * be overridden from JS — replacing the JS-side `.transform` is silently
   * ignored because rolldown invokes the native binding directly. Without
   * intervention, our `enforce: 'pre'` transform converts JSON to JS and then
   * `builtin:vite-json` runs anyway and fails to parse our JS as JSON.
   *
   * Workaround: in `resolveId`, remap each matching resource file to a
   * virtual id like `\0intlify-i18n-N`. The virtual id has no `.json` /
   * `.json5` suffix, so `builtin:vite-json` (which matches by extension) does
   * not claim it. Our `load` reads the original file from disk, runs the
   * generator, and returns the compiled JS.
   */
  const VITE_VIRTUAL_PREFIX = '\0intlify-i18n-'
  const virtualIdToRealPath = new Map<string, string>()
  const realPathToVirtualId = new Map<string, string>()
  let virtualCounter = 0

  function intlifyVirtualize(realPath: string): string {
    let virtualId = realPathToVirtualId.get(realPath)
    if (!virtualId) {
      virtualId = `${VITE_VIRTUAL_PREFIX}${virtualCounter++}`
      virtualIdToRealPath.set(virtualId, realPath)
      realPathToVirtualId.set(realPath, virtualId)
    }
    return virtualId
  }

  function isIntlifyVirtualId(id: string): boolean {
    return virtualIdToRealPath.has(id)
  }

  debug(`vue-i18n alias name: ${opts.module}`)

  // updated during compiler configuration
  const ctx: PluginCtx = {
    prod: false,
    sourceMap: false
  }

  // NOTE: webpack cannot dynamically resolve vue compiler, so use the compiler statically with import syntax
  let vuePlugin: RollupPlugin | null = null
  const getSfcParser = () => (vuePlugin ? getVueCompiler(vuePlugin).parse : parse)

  const resourcePaths = new Set<string>()
  for (const inc of opts.include || []) {
    for (const resourcePath of globSync(inc, {
      ignore: opts.exclude,
      expandDirectories: false,
      absolute: true
    })) {
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
    debug(`${meta.framework}: isProduction = ${ctx.prod}, sourceMap = ${ctx.sourceMap}`)

    // Eagerly compute the filter — webpack/rspack `Rule.include` is sync-only.
    // Seed the lazy cache so `getFilter()` reuses the same instance.
    const syncFilter = createFilter(...resolveIncludeExclude())
    _filter = syncFilter

    compiler.options.resolve.alias = {
      ...compiler.options.resolve.alias,
      [opts.module]: opts.vueI18nAliasPath
    }
    debug(`set ${opts.module}: ${opts.vueI18nAliasPath}`)

    const loader = meta.framework === 'webpack' ? loadWebpack : loadRspack
    loader()
      .then(mod => {
        // eslint-disable-next-line promise/always-return -- ignore
        if (mod) {
          compiler.options.plugins.push(
            // @ts-expect-error -- FIXME: webpack type
            new mod.DefinePlugin({
              __VUE_I18N_FULL_INSTALL__: JSON.stringify(opts.fullInstall),
              __INTLIFY_PROD_DEVTOOLS__: 'false'
            })
          )
          debug(`set __VUE_I18N_FULL_INSTALL__ is '${opts.fullInstall}'`)
        } else {
          debug(`ignore vue-i18n feature flags with ${meta.framework}.DefinePlugin`)
        }
      })
      .catch(_e => {
        warn(`${meta.framework} not found, please install ${meta.framework}.`)
      })

    // NOTE: avoid further transformation after i18n resources have been transformed into javascript.
    compiler.options.module.rules.push({
      test: /\.(json5?|ya?ml)$/,
      type: 'javascript/auto',
      include: resource => syncFilter(resource) || importedResources.has(resource)
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

      async configResolved(config) {
        vuePlugin = getVitePlugin(config, 'vite:vue')
        if (!checkVuePlugin(vuePlugin)) {
          return
        }

        ctx.prod = config.isProduction
        ctx.sourceMap = config.command === 'build' ? !!config.build.sourcemap : false
        debug(`configResolved: isProduction = ${ctx.prod}, sourceMap = ${ctx.sourceMap}`)

        /**
         * NOTE(kazupon):
         * Override `vite:json` plugin transform to prevent it from re-processing
         * JSON files that unplugin-vue-i18n has already compiled.
         *
         * Detect the builder by checking whether `vite:json` exists in
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
            // @ts-expect-error -- ignore
            return orgTransform.apply(this, [code, id])
          }

          if (isObjectHook) {
            transform.handler = overrideJson as typeof transform.handler
          } else {
            jsonPlugin.transform = overrideJson as typeof jsonPlugin.transform
          }
        }
      }
    },

    async resolveId(id: string, importer: string | undefined) {
      debug('resolveId', id, 'from', importer)
      if (id === INTLIFY_BUNDLE_IMPORT_ID) {
        return asVirtualId(id, meta.framework)
      }

      // For vite 8+ (no `vite:json` plugin), virtualize matching resource files
      // so `builtin:vite-json` does not claim them. See VITE_VIRTUAL_PREFIX above.
      if (meta.framework === 'vite' && !hasViteJsonPlugin) {
        // SFC custom-block requests with `lang.json` / `lang.json5` (e.g.
        // `Foo.vue?vue&type=i18n&index=0&lang.json`) also end in `.json` and
        // would be claimed by `builtin:vite-json`. Virtualize them too — our
        // `load` re-parses the SFC and extracts the block content.
        if (id.includes('?vue&type=i18n') && /[?&]lang\.(?:json|json5)(?:$|&)/.test(id)) {
          return intlifyVirtualize(id)
        }

        const idPath = id.split('?')[0]
        if (!supportedFileExtensionsRE.test(idPath)) return

        // unplugin v2.x does not expose `this.resolve`, so resolve relative
        // and absolute paths manually. Bare specifiers (package imports,
        // aliases) are left to vite's normal resolution.
        let resolvedPath: string
        if (idPath.startsWith('.')) {
          const realImporter =
            importer && isIntlifyVirtualId(importer) ? virtualIdToRealPath.get(importer)! : importer
          if (!realImporter) return
          resolvedPath = resolve(dirname(realImporter), idPath)
        } else if (idPath.startsWith('/') || /^[a-z]:[/\\]/i.test(idPath)) {
          resolvedPath = idPath
        } else {
          return
        }

        const filter = await getFilter()
        if (!filter(resolvedPath)) return

        return intlifyVirtualize(resolvedPath)
      }
    },

    loadInclude(id: string) {
      if (INTLIFY_BUNDLE_IMPORT_ID === getVirtualId(id, meta.framework)) return true
      return isIntlifyVirtualId(id)
    },

    async load(id: string) {
      debug('load', id)
      if (INTLIFY_BUNDLE_IMPORT_ID === getVirtualId(id, meta.framework) && resourcePaths.size > 0) {
        const code = generateBundleResources(resourcePaths)

        // watch resources to invalidate on change (webpack)
        for (const p of resourcePaths) {
          this.addWatchFile(p)
        }

        return result(code)
      }

      // vite 8+ virtualized resource — read the real file, run the i18n
      // generator, and return pre-compiled JS so `builtin:vite-json` never sees it.
      if (isIntlifyVirtualId(id)) {
        const realId = virtualIdToRealPath.get(id)!

        // SFC custom-block: parse the SFC and extract the block content
        // (mirrors what vite-plugin-vue's load would do, but yields a
        // virtual id whose extension does not trigger `builtin:vite-json`).
        if (realId.includes('?vue&type=i18n')) {
          const { filename, query } = parseVueRequest(realId)
          this.addWatchFile(filename)
          const sfcSource = readFile(filename)
          const { descriptor } = getSfcParser()(sfcSource, {
            sourceMap: ctx.sourceMap,
            filename
          })
          const block = descriptor.customBlocks[query.index!]
          if (!block) return

          let source = block.src ? readFile(block.src) : block.content
          if (typeof opts.transformI18nBlock === 'function') {
            const modifiedSource = opts.transformI18nBlock(source)
            if (modifiedSource && typeof modifiedSource === 'string') {
              source = modifiedSource
            } else {
              warn('transformI18nBlock should return a string')
            }
          }

          const langInfo = (query.lang as SFCLangFormat) || (opts.defaultSFCLang as SFCLangFormat)
          const generate = getGenerator(langInfo, generateYAML)
          const parseOptions = getOptions(filename, ctx, query, {
            ...opts,
            allowDynamic: false,
            transformI18nBlock: undefined
          })
          const { code: generatedCode } = generate(source, parseOptions)
          return result(generatedCode)
        }

        // Plain resource file
        const realPath = realId
        this.addWatchFile(realPath)

        const code = readFile(realPath)

        // mirror the static-import discovery that `transform` does for the
        // rollup-vite path — keeps `importedResources` populated so sibling
        // imports also pass the filter.
        const imports = findStaticImports(code)
        for (const p of imports) {
          const res = resolve(dirname(realPath), p.specifier)
          importedResources.add(res)
        }

        const langInfo = parsePath(realPath).ext as SFCLangFormat
        const generate = getGenerator(langInfo)
        const parseOptions = getOptions(realPath, ctx, {} as VueQuery, {
          ...opts,
          transformI18nBlock: undefined
        })

        try {
          const { code: generatedCode } = generate(code, parseOptions)
          return result(generatedCode)
        } catch (err) {
          if (err instanceof DynamicResourceError) {
            error(
              `Unable to precompile or optimize \`${realPath}\` - excluding from virtual bundle \`${INTLIFY_BUNDLE_IMPORT_ID}\`.\n`,
              err
            )
            return `export default {}`
          } else {
            throw err
          }
        }
      }
    },

    transformInclude(id) {
      debug('transformInclude', id)
      if (meta.framework === 'vite') {
        return true
      }

      // For webpack/rspack: `_filter` is guaranteed initialized by `sharedWebpackLikePlugin`
      // before the bundler ever invokes `transformInclude`. Defensive bootstrap for safety.
      const f = _filter ?? createFilter(...resolveIncludeExclude())
      if (_filter == null) {
        _filter = f
      }
      const filterWithImported = (v: string) => f(v) || importedResources.has(v)

      const { filename, query } = parseVueRequest(id)

      // vue file or virtual bundle
      if (filename.endsWith('vue') || filename.endsWith(INTLIFY_BUNDLE_IMPORT_ID)) {
        return true
      }

      // include imports by custom-blocks
      let isResourcePath = resourcePaths.has(id)
      if (!isResourcePath && 'issuerPath' in query) {
        isResourcePath = resourcePaths.has(query.issuerPath!)
      }

      // locale resource
      return (
        supportedFileExtensionsRE.test(filename) && filterWithImported(filename) && isResourcePath
      )
    },

    async transform(code, id) {
      // Skip vite 8 virtualized resources — already loaded as compiled JS.
      if (isIntlifyVirtualId(id)) return

      const { filename, query } = parseVueRequest(id)
      debug('transform', id, JSON.stringify(query), filename)

      let langInfo = opts.defaultSFCLang

      const filter = await getFilter()
      if (filter(id)) {
        const imports = findStaticImports(code)
        for (const p of imports) {
          const res = resolve(dirname(id), p.specifier)
          importedResources.add(res)
        }
      }

      // virtual @intlify/unplugin-vue-i18n/messages
      if (!query.vue && supportedFileExtensionsRE.test(id) && filter(id)) {
        langInfo = parsePath(filename).ext as SFCLangFormat

        const generate = getGenerator(langInfo)
        const parseOptions = getOptions(filename, ctx, query, {
          ...opts,
          transformI18nBlock: undefined
        })

        debug('parseOptions', parseOptions)

        try {
          const { code: generatedCode, map } = generate(code, parseOptions)

          debug('generated code', generatedCode)
          debug('sourcemap', map, ctx.sourceMap)

          if (code === generatedCode) return

          return result(generatedCode)
        } catch (err) {
          if (err instanceof DynamicResourceError) {
            error(
              `Unable to precompile or optimize \`${filename}\` - excluding from virtual bundle \`${INTLIFY_BUNDLE_IMPORT_ID}\`.\n`,
              err
            )
            // transform to empty resource to ensure a working merged bundle
            return `export default {}`
          } else {
            throw err
          }
        }
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

        let source = getCode(code, filename, ctx.sourceMap, query, getSfcParser(), meta)

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
type GeneratorLike = (source: string | Buffer, options: CodeGenOptions) => CodeGenResult<unknown>
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
    const varName = genSafeVariableName(
      [name, createHash('sha256').update(filename).digest('hex').substring(0, 8)].join('_')
    )
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
  ${codes.map(code => `{ ${code} }`).join(',\n  ')}
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
    debug(`getCode (${meta.framework}) ${query.index} via issuerPath`, query.issuerPath)
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

function readFile(path: string): string {
  return fs.readFileSync(path, 'utf-8')
}
