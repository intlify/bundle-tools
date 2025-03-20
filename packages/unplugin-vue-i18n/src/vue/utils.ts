import type { RollupPlugin } from 'unplugin'
import type * as _compiler from 'vue/compiler-sfc'

export function getVueCompiler(vuePlugin: RollupPlugin): typeof _compiler {
  return vuePlugin?.api?.options.compiler as typeof _compiler
}
export type VueCompilerParser = ReturnType<typeof getVueCompiler>['parse']
