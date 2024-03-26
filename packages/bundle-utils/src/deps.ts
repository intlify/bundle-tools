import module from 'node:module'

export type InstalledPackage = 'vue-i18n' | 'petite-vue-i18n'

const _require = module.createRequire(import.meta.url)

// eslint-disable-next-line @typescript-eslint/ban-types
export function checkInstallPackage(
  pkg: string,
  debug: Function
): InstalledPackage {
  let installedVueI18n = false
  try {
    debug(`vue-i18n load path: ${_require.resolve('vue-i18n')}`)
    installedVueI18n = true
  } catch (e) {
    debug(`cannot find 'vue-i18n'`, e)
  }

  let installedPetiteVueI18n = false
  try {
    debug(`petite-vue-i18n load path: ${_require.resolve('petite-vue-i18n')}`)
    installedPetiteVueI18n = true
  } catch (e) {
    debug(`cannot find 'petite-vue-i18n'`, e)
  }

  if (installedVueI18n) {
    return 'vue-i18n'
  }
  if (installedPetiteVueI18n) {
    return 'petite-vue-i18n'
  }
  throw new Error(
    `${pkg} requires 'vue-i18n' or 'petite-vue-i18n' to be present in the dependency tree.`
  )
}

type VueI18nVersion = '8' | '9' | 'unknown' | ''

export function getVueI18nVersion(debug: Function): VueI18nVersion {
  const VueI18n = loadModule('vue-i18n', debug)
  if (VueI18n == null) {
    return ''
  }
  if (VueI18n.version && VueI18n.version.startsWith('8.')) {
    return '8'
  }
  if (VueI18n.VERSION && VueI18n.VERSION.startsWith('9.')) {
    return '9'
  }
  return 'unknown'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadModule(moduleName: string, debug: Function): any {
  try {
    return _require(moduleName)
  } catch (e) {
    debug(`cannot load '${moduleName}'`, e)
    return null
  }
}
