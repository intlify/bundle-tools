import fs from 'node:fs'
import createDebug from 'debug'
import module from 'node:module'
import path from 'node:path'
import { resolvePackageJSON } from './pkg'

const SUPPORT_PACKAGES = ['vue-i18n', 'petite-vue-i18n'] as const

type SupportPackage = (typeof SUPPORT_PACKAGES)[number]

export type InstalledPackageInfo = {
  alias: string
  pkg: SupportPackage
}

const _require = module.createRequire(import.meta.url)

export function checkInstallPackage(
  debug: createDebug.Debugger
): InstalledPackageInfo {
  const pkgInfo =
    resolvePkgPath('vue-i18n', debug) ||
    resolvePkgPath('petite-vue-i18n', debug)
  if (!pkgInfo) {
    throw new Error(
      `requires 'vue-i18n' or 'petite-vue-i18n' to be present in the dependency tree.`
    )
  }

  debug('installed package info:', pkgInfo)
  return pkgInfo
}

function resolvePkgPath(
  id: string,
  debug: createDebug.Debugger
): InstalledPackageInfo | null {
  try {
    /**
     * NOTE:
     *  Assuming the case of using npm alias `npm:`,
     *  get the installed package name from `package.json`
     */
    const modPath = _require.resolve(id)
    debug('modPath:', modPath, id)
    const pkgJsonPath = resolvePackageJSON(modPath)
    debug('pkgJsonPath:', pkgJsonPath)
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')) as {
      name: string
    }
    const pkgName: string = pkgJson.name.startsWith('vue-i18n')
      ? 'vue-i18n'
      : pkgJson.name.startsWith('petite-vue-i18n')
        ? 'petite-vue-i18n'
        : ''
    return pkgJson ? { alias: id, pkg: pkgName as SupportPackage } : null
  } catch (e) {
    debug(`cannot find '${id}'`, e)
    return null
  }
}
