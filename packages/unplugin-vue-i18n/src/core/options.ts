import { normalize } from 'pathe'
import { isString, isBoolean, isArray } from '@intlify/shared'

import type { PluginOptions } from '../types'
import type { InstalledPackageInfo } from '../utils'

export function resolveOptions(
  options: PluginOptions,
  installedPkgInfo: InstalledPackageInfo
) {
  // normalize for `options.onlyLocales`
  let onlyLocales: string[] = []
  if (options.onlyLocales) {
    onlyLocales = isArray(options.onlyLocales)
      ? options.onlyLocales
      : [options.onlyLocales]
  }

  // normalize for `options.include`
  let include = options.include
  let exclude = undefined
  if (include) {
    if (isArray(include)) {
      include = include.map(item => normalize(item))
    } else if (isString(include)) {
      include = normalize(include)
    }
  } else {
    exclude = '**/**'
  }

  const forceStringify = !!options.forceStringify
  const defaultSFCLang = isString(options.defaultSFCLang)
    ? options.defaultSFCLang
    : 'json'
  const globalSFCScope = !!options.globalSFCScope

  const runtimeOnly = isBoolean(options.runtimeOnly)
    ? options.runtimeOnly
    : true

  const dropMessageCompiler = !!options.dropMessageCompiler

  // prettier-ignore
  const compositionOnly = installedPkgInfo.pkg === 'vue-i18n'
      ? isBoolean(options.compositionOnly)
        ? options.compositionOnly
        : true
      : true

  // prettier-ignore
  const fullInstall = installedPkgInfo.pkg === 'vue-i18n'
    ? isBoolean(options.fullInstall)
      ? options.fullInstall
      : true
    : false

  const ssrBuild = !!options.ssr

  const allowDynamic = !!options.allowDynamic

  const strictMessage = isBoolean(options.strictMessage)
    ? options.strictMessage
    : true

  const escapeHtml = !!options.escapeHtml

  return {
    include,
    exclude,
    onlyLocales,
    forceStringify,
    defaultSFCLang,
    globalSFCScope,
    runtimeOnly,
    dropMessageCompiler,
    compositionOnly,
    fullInstall,
    ssrBuild,
    allowDynamic,
    strictMessage,
    escapeHtml
  }
}

export type ResolvedOptions = ReturnType<typeof resolveOptions>
