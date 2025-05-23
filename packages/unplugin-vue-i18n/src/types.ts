export type SFCLangFormat = 'json' | 'json5' | 'yml' | 'yaml'
export type VueI18nModule = 'vue-i18n' | 'petite-vue-i18n'

export interface PluginOptions {
  include?: string | string[]
  exclude?: string | string[]
  onlyLocales?: string | string[]
  allowDynamic?: boolean
  module?: VueI18nModule
  dropMessageCompiler?: boolean
  runtimeOnly?: boolean
  ssr?: boolean
  fullInstall?: boolean
  forceStringify?: boolean
  defaultSFCLang?: SFCLangFormat
  globalSFCScope?: boolean
  strictMessage?: boolean
  escapeHtml?: boolean
  transformI18nBlock?: (src: string | Buffer) => string
}
