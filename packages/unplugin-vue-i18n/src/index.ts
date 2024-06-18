import { createUnplugin } from 'unplugin'
import createDebug from 'debug'
import { raiseError, checkInstallPackage, resolveNamespace } from './utils'
import { resolveOptions } from './core/options'
import { resourcePlugin } from './core/resource'
import { directivePlugin } from './core/directive'

import type { PluginOptions } from './types'

const debug = createDebug(resolveNamespace('root'))
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

  const plugins = [resourcePlugin(resolvedOptions, meta, installedPkgInfo)]
  if (resolvedOptions.optimizeTranslationDirective) {
    plugins.push(directivePlugin(resolvedOptions))
  }

  return plugins
})

export default unplugin

export * from './types'
