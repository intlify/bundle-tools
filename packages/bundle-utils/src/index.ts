export { generate as generateJSON } from './json'
export { generate as generateYAML } from './yaml'
export {
  generate as generateJavaScript,
  initParser as initJavascriptParser
} from './js'
export { getVueI18nVersion, checkInstallPackage } from './deps'
export type { CodeGenOptions, CodeGenResult, DevEnv } from './codegen'
export type { InstalledPackage } from './deps'
