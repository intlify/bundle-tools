import createDebug from 'debug'
import { createUnplugin } from 'unplugin'
import {
  createUsedKeysCollector,
  directivePlugin,
  resolveOptions,
  resourcePlugin,
  treeShakingPlugin
} from './core'
import { raiseError, resolveNamespace } from './utils'

import type { UnpluginFactory, UnpluginInstance } from 'unplugin'
import type { PluginOptions } from './types'

const debug = createDebug(resolveNamespace('root'))

export * from './types'

export const unpluginFactory: UnpluginFactory<PluginOptions | undefined> = (options = {}, meta) => {
  debug('meta framework', meta.framework)
  // check bundler type
  if (!['vite', 'webpack'].includes(meta.framework)) {
    raiseError(`This plugin is supported 'vite' and 'webpack' only`)
  }

  debug('plugin options (resolving):', options)
  const resolvedOptions = resolveOptions(options)
  debug('plugin options (resolved):', resolvedOptions)

  // Create shared collector if tree-shaking is enabled
  const collector = resolvedOptions.treeShaking
    ? createUsedKeysCollector(resolvedOptions.treeShaking)
    : null

  const plugins = []

  // Tree-shaking plugin runs first to collect used keys before locale files are processed
  if (resolvedOptions.treeShaking && collector) {
    plugins.push(treeShakingPlugin(resolvedOptions, collector))
  }

  plugins.push(resourcePlugin(resolvedOptions, meta, collector))

  if (resolvedOptions.optimizeTranslationDirective) {
    if (meta.framework === 'webpack') {
      raiseError(
        `The 'optimizeTranslationDirective' option still is not supported for webpack.\n` +
          `We are waiting for your Pull Request 🙂.`
      )
    }
    plugins.push(directivePlugin(resolvedOptions))
  }

  return plugins
}

export const unplugin: UnpluginInstance<PluginOptions | undefined, boolean> =
  /* #__PURE__ */ createUnplugin(unpluginFactory)

/** @alias */
export default unplugin
