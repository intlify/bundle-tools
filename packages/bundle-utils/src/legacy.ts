import { friendlyJSONstringify } from '@intlify/shared'

import type { CodeGenOptions } from './codegen'

export function generateLegacyCode(
  {
    isGlobal = false,
    vueVersion = 'v2.6'
  }: Pick<CodeGenOptions, 'isGlobal' | 'vueVersion'>,
  generator: () => string
) {
  // prettier-ignore
  const componentNamespace = `Component${ vueVersion === 'v2.6' ? '.options' : ''}`
  const variableName = !isGlobal ? '__i18n' : '__i18nGlobal'
  const exportSyntax = 'export default'
  const code = `${exportSyntax} function (Component) {
  ${componentNamespace}.${variableName} = ${componentNamespace}.${variableName} || []
  ${componentNamespace}.${variableName}.push(${friendlyJSONstringify(
    generator()
  )})
  delete ${componentNamespace}._Ctor
}`
  return code
}
