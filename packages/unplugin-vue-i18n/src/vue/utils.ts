import type * as _compiler from 'vue/compiler-sfc'
import type { RollupPlugin } from 'unplugin'

export function getVueCompiler(vuePlugin: RollupPlugin): typeof _compiler {
  return vuePlugin?.api?.options.compiler as typeof _compiler
}

export type VuePluginResolvedOptions = {
  isProduction: boolean
  root: string
  compiler: typeof _compiler
  template?: Partial<
    Omit<
      _compiler.SFCTemplateCompileOptions,
      | 'id'
      | 'source'
      | 'ast'
      | 'filename'
      | 'scoped'
      | 'slotted'
      | 'isProd'
      | 'inMap'
      | 'ssr'
      | 'ssrCssVars'
      | 'preprocessLang'
    >
  >
}

export function getVuePluginOptions(
  vuePlugin: RollupPlugin
): VuePluginResolvedOptions {
  return {
    isProduction: vuePlugin?.api?.options.isProduction,
    root: vuePlugin?.api?.options.root,
    template: vuePlugin?.api?.options.template,
    compiler: vuePlugin?.api?.options.compiler as typeof _compiler
  }
}
