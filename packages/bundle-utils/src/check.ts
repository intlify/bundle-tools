export type InstalledPackage = 'vue-i18n' | 'petite-vue-i18n'

// eslint-disable-next-line @typescript-eslint/ban-types
export function checkInstallPackage(
  pkg: string,
  debug: Function
): InstalledPackage {
  let installedVueI18n = false
  try {
    debug(`vue-i18n load path: ${require.resolve('vue-i18n')}`)
    installedVueI18n = true
  } catch (e) {
    debug(`cannot find 'vue-i18n'`, e)
  }

  let installedPetiteVueI18n = false
  try {
    debug(`petite-vue-i18n load path: ${require.resolve('petite-vue-i18n')}`)
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

// eslint-disable-next-line @typescript-eslint/ban-types
export function checkVueI18nBridgeInstallPackage(debug: Function): boolean {
  let ret = false
  try {
    debug(`vue-i18n-bridge load path: ${require.resolve('vue-i18n-bridge')}`)
    ret = true
  } catch (e) {
    debug(`cannot find 'vue-i18n-bridge'`, e)
  }
  return ret
}
