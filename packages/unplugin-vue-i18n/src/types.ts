export type SFCLangFormat = 'json' | 'json5' | 'yml' | 'yaml'
export interface PluginOptions {
  include?: string | string[]
  runtimeOnly?: boolean
  compositionOnly?: boolean
  fullInstall?: boolean
  forceStringify?: boolean
  defaultSFCLang?: SFCLangFormat
  globalSFCScope?: boolean
  bridge?: boolean
  useClassComponent?: boolean
}
