export type SFCLangFormat = 'json' | 'json5' | 'yml' | 'yaml'
export interface PluginOptions {
  include?: string | string[]
  onlyLocales?: string | string[]
  allowDynamic?: boolean
  dropMessageCompiler?: boolean
  runtimeOnly?: boolean
  compositionOnly?: boolean
  ssr?: boolean
  fullInstall?: boolean
  forceStringify?: boolean
  defaultSFCLang?: SFCLangFormat
  globalSFCScope?: boolean
  strictMessage?: boolean
  escapeHtml?: boolean
  optimizeTranslationDirective?: boolean | string | string[]
  transformI18nBlock?: (src: string | Buffer) => string
}
