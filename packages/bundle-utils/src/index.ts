export { generate as generateJSON } from './json'
export { generate as generateYAML } from './yaml'
export { generate as generateJavaScript } from './js'
export {
  getVueI18nVersion,
  checkInstallPackage,
  checkVueI18nBridgeInstallPackage
} from './deps'
export type { CodeGenOptions, CodeGenResult, DevEnv } from './codegen'
export type { InstalledPackage } from './deps'
