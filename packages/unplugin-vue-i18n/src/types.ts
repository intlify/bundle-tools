export type SFCLangFormat = 'json' | 'json5' | 'yml' | 'yaml'
export interface PluginOptions {
  include?: string | string[]
  allowDynamic?: boolean
  jitCompilation?: boolean
  runtimeOnly?: boolean
  compositionOnly?: boolean
  fullInstall?: boolean
  esm?: boolean
  forceStringify?: boolean
  defaultSFCLang?: SFCLangFormat
  globalSFCScope?: boolean
  bridge?: boolean
  useClassComponent?: boolean
  useVueI18nImportName?: boolean
  strictMessage?: boolean
  escapeHtml?: boolean
}
