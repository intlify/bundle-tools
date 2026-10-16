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
const VITE_VIRTUAL_PREFIX = 'virtual:intlify-i18n-'

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
    // prettier-ignore
    return include
      ? [[...include, customBlockInclude], undefined]
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
  const vueI18nAliasName = module
  debug(`vue-i18n alias name: ${vueI18nAliasName}`)

  let vuePlugin: RollupPlugin | null = null
  // NOTE:
  // webpack cannot dynamically resolve vue compiler, so use the compiler statically with import syntax
  const getSfcParser = () => {
    return vuePlugin ? getVueCompiler(vuePlugin).parse : parse
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
   * virtual id like `virtual:intlify-i18n-<key>/<name>`. The virtual id has no `.json` /
   * `.json5` suffix, so `builtin:vite-json` (which matches by extension) does
   * not claim it. Our `load` reads the original file from disk, runs the
   * generator, and returns the compiled JS.
   *
   * The key is the path of the resource relative to the root, in base64url. The
   * same resource gets the same id in every process, and any process can read
   * the resource from the id alone, e.g. for an importer that a persistent
   * transform cache (such as Vitest's `fsModuleCache`) kept from an earlier run.
   * The path is relative so that the id, which can appear in the output (region
   * comments), does not depend on where the project is.
   *
   * The id ends with the name of the file (e.g. `/en` for `en.json`): bundlers
   * name chunks and variables after the end of an id, so a lazily loaded
   * resource gets a chunk like `en-<hash>.js`, as on vite 6, and not a name
   * with the key, which can be longer than a file name can be.
   *
   * Only existing JSON / JSON5 files are remapped:
   * - other resources (YAML, JS, TS) are not claimed by `builtin:vite-json`,
   *   so they keep their real ids and go through `transform`, as on vite 6.
   * - `import.meta.glob` resolves an aliased pattern (e.g. `@/locales/*.json`)
   *   through `resolveId` and needs an absolute path back, not a virtual id.
   */
  // the root that the keys of virtual ids are relative to (set in `configResolved`)
  let virtualRoot = normalize(process.cwd())

  function virtualIdFromKey(key: string): string {
    // the name of the file, with only the characters that mean nothing in an id or a url
    const name = parsePath(key.split('?')[0]).name.replace(/[^\w-]/g, '_')
    return `${VITE_VIRTUAL_PREFIX}${Buffer.from(key).toString('base64url')}/${name}`
  }

  function intlifyVirtualize(realPath: string): string {
    return virtualIdFromKey(relative(virtualRoot, normalize(realPath)))
  }

  function virtualIdToRealPath(id: string): string | undefined {
    if (!id.startsWith(VITE_VIRTUAL_PREFIX)) return
    const encoded = id.slice(VITE_VIRTUAL_PREFIX.length).split('/')[0]
    const key = Buffer.from(encoded, 'base64url').toString()
    // an id in another form, such as a numbered one cached by an older version, is not ours
    if (!key || virtualIdFromKey(key) !== id) return
    return resolve(virtualRoot, key)
  }

  function isIntlifyVirtualId(id: string): boolean {
    return virtualIdToRealPath(id) !== undefined
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
        virtualRoot = normalize(config.root)
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
        const key = normalize(file)
        const virtualId = intlifyVirtualize(key)
        const inBundle = !!(include && createFilter(include, exclude)(key))

        if (!inBundle && !server.moduleGraph.getModuleById(virtualId)) return

        const affected = new Set(modules)
        const addById = (id: string | undefined) => {
          const mod = id && server.moduleGraph.getModuleById(id)
          if (mod) affected.add(mod)
        }

        addById(virtualId)
        if (inBundle) {
          addById(asVirtualId(INTLIFY_BUNDLE_IMPORT_ID, meta.framework))
        }

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
      async handler(id: string, importer: string | undefined) {
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
            const { filename, query } = parseVueRequest(id)
            let virtualKey = id
            // @vitejs/plugin-vue routes `src` blocks through the sidecar file path
            // (e.g. `./Foo.i18n.json5?vue&type=i18n&index=0&src=true&lang.json5`), not the .vue path.
            // Key on the owning .vue instead, keeping the query (`index`, `src`): `load` then reads the
            // SFC and resolves the sidecar from the block's own `src` attribute, so the sidecar path
            // comes from the component, not from the id. The id always points at a .vue this way.
            if (query.src && importer) {
              const importerPath = (virtualIdToRealPath(importer) ?? importer).split('?')[0]
              if (importerPath.endsWith('.vue')) {
                virtualKey = id.replace(filename, importerPath)
              }
            }
            return intlifyVirtualize(virtualKey)
          }

          const idPath = id.split('?')[0]
          // `builtin:vite-json` claims only JSON / JSON5, so other resources keep their real ids.
          if (!/\.json5?$/.test(idPath)) return

          // unplugin v2.x does not expose `this.resolve` reliably across
          // bundlers, so resolve relative and absolute paths manually. Bare
          // specifiers (package imports, aliases) are left to vite's normal
          // resolution.
          let resolvedPath: string
          if (idPath.startsWith('.')) {
            const realImporter = (importer && virtualIdToRealPath(importer)) || importer
            if (!realImporter) return
            resolvedPath = resolve(dirname(realImporter), idPath)
          } else if (idPath.startsWith('/') || /^[a-z]:[/\\]/i.test(idPath)) {
            resolvedPath = idPath
          } else {
            return
          }

          const filter = await getFilter()
          if (!filter(resolvedPath)) return
          // Skip non-files, such as an aliased glob pattern (e.g. `@/locales/*.json`).
          const stat = await fs.stat(resolvedPath).catch(() => null)
          if (!stat?.isFile()) return

          return intlifyVirtualize(resolvedPath)
        }
      }
    },

    loadInclude(id: string) {
      return INTLIFY_BUNDLE_IMPORT_ID === getVirtualId(id, meta.framework) || isIntlifyVirtualId(id)
    },

    load: {
      async handler(id: string) {
        debug('load', id)
        if (INTLIFY_BUNDLE_IMPORT_ID === getVirtualId(id, meta.framework) && include) {
          let resourcePaths = [] as string[]
          for (const inc of include) {
            // tinyglobby 0.2.16 takes its default `cwd` on import, so pass the current one
            resourcePaths = [
              ...resourcePaths,
              ...(await glob(inc, { cwd: process.cwd(), expandDirectories: false, absolute: true }))
            ]
          }
          resourcePaths = resourcePaths.filter((el, pos) => resourcePaths.indexOf(el) === pos)
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

        // vite 8+ virtualized resource — read the real file, run the i18n
        // generator, and return pre-compiled JS so `builtin:vite-json` never sees it.
        const realId = virtualIdToRealPath(id)
        if (realId) {
          // `virtualIdToRealPath` only checks that the id is well-formed, so re-apply the checks
          // that `resolveId` makes before it virtualizes a request. Otherwise a crafted or stale id
          // could make `load` read and return a file that is not an i18n resource: a dev server
          // passes any `/@id/` url to plugin `load`, before its `server.fs.allow` / `deny` checks.
          if (realId.includes('?vue&type=i18n')) {
            const { filename } = parseVueRequest(realId)
            // Both inline and src blocks are keyed on the owning .vue (see resolveId), so the id must
            // name a .vue. `load` reads the SFC and, for a src block, resolves the sidecar from the
            // block's `src` attribute — the id never carries the sidecar path.
            if (!(/[?&]lang\.(?:json|json5)(?:$|&)/.test(realId) && filename.endsWith('.vue')))
              return
          } else if (!(/\.json5?$/.test(realId) && (await getFilter())(realId))) {
            return
          }

          // SFC custom-block: parse the SFC and extract the block content
          // (mirrors what vite-plugin-vue's load would do, but yields a
          // virtual id whose extension does not trigger `builtin:vite-json`).
          if (realId.includes('?vue&type=i18n')) {
            const { filename, query } = parseVueRequest(realId)

            // `filename` is the owning .vue (see resolveId). Parse the SFC and take the block at `index`.
            this.addWatchFile(filename)
            const sfcSource = await fs.readFile(filename, 'utf-8')
            const { descriptor } = getSfcParser()(sfcSource, {
              sourceMap,
              filename
            })
            const block = descriptor.customBlocks[query.index!]
            // only an i18n block at this index is ours — a crafted id must not select another
            // custom block (e.g. `<config src>`) and have its content returned as i18n
            if (!block || block.type !== 'i18n') return

            let source: string
            if (block.attrs.src) {
              // `<i18n src="...">`: the sidecar comes from the block's own `src` attribute, resolved
              // relative to the .vue — not from the id, so a crafted id cannot point it elsewhere.
              const sidecar = resolve(dirname(filename), String(block.attrs.src))
              this.addWatchFile(sidecar)
              source = await fs.readFile(sidecar, 'utf-8')
            } else {
              source = block.content
            }
            if (typeof transformI18nBlock === 'function') {
              const modifiedSource = transformI18nBlock(source)
              if (modifiedSource && typeof modifiedSource === 'string') {
                source = modifiedSource
              } else {
                warn('transformI18nBlock should return a string')
              }
            }

            let langInfo = defaultSFCLang as Required<PluginOptions>['defaultSFCLang']
            if (isString(query.lang)) {
              langInfo = (
                query.src ? (query.lang === 'i18n' ? defaultSFCLang : query.lang) : query.lang
              ) as Required<PluginOptions>['defaultSFCLang']
            }

            // For JS/TS custom blocks, wrap source with `export default`
            if (/\.?[cm]?[jt]s$/.test(langInfo)) {
              source = `export default ${source.replace(/^[\s;]+/, '')}`
            }

            const generate = getGenerator(langInfo, generateYAML)
            const isGlobalBlock = globalSFCScope || !!query.global
            const parseOptions = getOptions(
              filename,
              isProduction,
              query as Record<string, unknown>,
              sourceMap,
              {
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
            const { code: generatedCode } = await generate(source, parseOptions)
            return {
              moduleType: 'js',
              code: generatedCode,
              map: { mappings: '' }
            }
          }

          // Plain resource file
          this.addWatchFile(realId)
          const code = await fs.readFile(realId, 'utf-8')
          const langInfo = parsePath(realId).ext as Required<PluginOptions>['defaultSFCLang']
          const generate = getGenerator(langInfo)
          const parseOptions = getOptions(
            realId,
            isProduction,
            {} as Record<string, unknown>,
            sourceMap,
            {
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
          const { code: generatedCode } = await generate(code, parseOptions)
          return {
            moduleType: 'js',
            code: generatedCode,
            map: { mappings: '' }
          }
        }
      }
    },

    transform: {
      async handler(code: string, id: string) {
        // Skip vite 8 virtualized resources — already loaded as compiled JS.
        if (isIntlifyVirtualId(id)) return

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
