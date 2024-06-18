import fs from 'node:fs'
import { promises as fsp } from 'node:fs'
import createDebug from 'debug'
import pc from 'picocolors'
import module from 'node:module'
import path from 'node:path'

import type { VitePlugin, RollupPlugin } from 'unplugin'

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
    const resolvedPath = _require.resolve(id)
    const pkgPath = path.dirname(resolvedPath)
    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(pkgPath, 'package.json'), 'utf-8')
    ) as { name: string }
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

export function resolveNamespace(name: string): string {
  return `unplugin-vue-i18n:${name}`
}

export function warn(...args: unknown[]) {
  console.warn(pc.yellow(pc.bold(`[unplugin-vue-i18n] `)), ...args)
}

export function error(...args: unknown[]) {
  console.error(pc.red(pc.bold(`[unplugin-vue-i18n] `)), ...args)
}

export async function getRaw(path: string): Promise<string> {
  return fsp.readFile(path, { encoding: 'utf-8' })
}

export function raiseError(message: string) {
  throw new Error(`[unplugin-vue-i18n] ${message}`)
}

// @ts-expect-error -- FIXME: plugin type
type UserConfig = Parameters<VitePlugin['configResolved']>[0]

export function getVitePlugin(
  config: UserConfig,
  name: string
): RollupPlugin | null {
  // vite plugin has compoaibility for rollup plugin
  return config.plugins.find(p => p.name === name) as RollupPlugin
}

export function checkVuePlugin(vuePlugin: RollupPlugin | null): boolean {
  if (vuePlugin == null || !vuePlugin.api) {
    error(
      '`@vitejs/plugin-vue` plugin is not found or invalid version. Please install `@vitejs/plugin-vue` v4.3.4 or later version.'
    )
    return false
  }
  return true
}

const isWindows = typeof process !== 'undefined' && process.platform === 'win32'

const windowsSlashRE = /\\/g
function slash(p: string): string {
  return p.replace(windowsSlashRE, '/')
}

export function normalizePath(id: string): string {
  return path.posix.normalize(isWindows ? slash(id) : id)
}
