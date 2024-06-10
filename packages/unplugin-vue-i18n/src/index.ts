import { createUnplugin } from 'unplugin'
import createDebug from 'debug'
import { raiseError, checkInstallPackage } from './utils'
import { resolveOptions } from './core/options'
import { resourcePlugin } from './core/resource'

import type { PluginOptions } from './types'

const debug = createDebug('unplugin-vue-i18n:root')
const installedPkgInfo = checkInstallPackage(debug)

export const unplugin = createUnplugin<PluginOptions>((options = {}, meta) => {
  debug('meta framework', meta.framework)
  // check bundler type
  if (!['vite', 'webpack'].includes(meta.framework)) {
    raiseError(`This plugin is supported 'vite' and 'webpack' only`)
  }

  debug('plugin options (resolving):', options)
  const resolvedOptions = resolveOptions(options, installedPkgInfo)
  debug('plugin options (resolved):', resolvedOptions)

  return [resourcePlugin(resolvedOptions, meta, installedPkgInfo)]
})

export default unplugin

export * from './types'
