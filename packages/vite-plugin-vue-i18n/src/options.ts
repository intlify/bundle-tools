export type VitePluginVueI18nOptions = {
  forceStringify?: boolean
  runtimeOnly?: boolean
  compositionOnly?: boolean
  fullInstall?: boolean
  include?: string | string[]
  defaultSFCLang?: 'json' | 'json5' | 'yml' | 'yaml'
  globalSFCScope?: boolean
}
