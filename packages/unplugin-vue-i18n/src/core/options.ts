import defu from 'defu'
import { normalize } from 'pathe'
import { toArray } from '../utils/misc'

import type { PluginOptions, SFCLangFormat } from '../types'
import type { TranslationDirectiveResolveIndetifier } from '../vue'

/**
 * Creates a path to the correct vue-i18n build used as alias (e.g. `vue-i18n/dist/vue-i18n.runtime.node.js`)
 */
const getVueI18nAliasPath = (opts: {
  runtimeOnly: boolean
  ssr: boolean
  module: string
}) => {
  const filename = [
    opts.module,
    opts.runtimeOnly ? 'runtime' : '',
    !opts.ssr ? 'esm-bundler' : 'node',
    'js'
  ]
    .filter(Boolean)
    .join('.')

  return `${opts.module}/dist/${filename}`
}

/**
 * Applies default values to user options and normalizes to narrowed type
 */
export function resolveOptions(options: PluginOptions) {
  const res = defu(options, {
    ssr: false,
    module: 'vue-i18n',
    escapeHtml: false,
    onlyLocales: [] as string[],
    fullInstall: true,
    runtimeOnly: true,
    strictMessage: true,
    allowDynamic: false,
    globalSFCScope: false,
    forceStringify: false,
    defaultSFCLang: 'json' as SFCLangFormat,
    dropMessageCompiler: false,
    transformI18nBlock: undefined,
    optimizeTranslationDirective: false
  })

  const include = res.include
    ? toArray(res.include).map(item => normalize(item))
    : undefined

  const _exclude = res.exclude
    ? toArray(res.exclude).map(item => normalize(item))
    : undefined

  const exclude = res.include ? _exclude : ['**/**']

  const onlyLocales = toArray(res.onlyLocales)

  const fullInstall = res.module !== 'vue-i18n' ? false : res.fullInstall

  const optimizeTranslationDirective =
    typeof res.optimizeTranslationDirective === 'boolean'
      ? res.optimizeTranslationDirective
      : toArray(res.optimizeTranslationDirective)

  const translationIdentifiers = new Map<
    string,
    TranslationDirectiveResolveIndetifier
  >()

  const vueI18nAliasPath = getVueI18nAliasPath(res)

  return {
    ...res,
    include,
    exclude,
    fullInstall,
    onlyLocales,
    vueI18nAliasPath,
    translationIdentifiers,
    optimizeTranslationDirective
  }
}

export type ResolvedOptions = ReturnType<typeof resolveOptions>
