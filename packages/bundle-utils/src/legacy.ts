import { friendlyJSONstringify } from '@intlify/shared'

import type { CodeGenOptions } from './codegen'

export function generateLegacyCode(
  { isGlobal }: CodeGenOptions,
  generator: () => string
) {
  // prettier-ignore
  const componentNamespace = `Component.options`
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
