import { createUnplugin } from 'unplugin'
import createDebug from 'debug'
import { raiseError, resolveNamespace } from './utils'
import { resolveOptions, resourcePlugin, directivePlugin } from './core'

import type { UnpluginFactory, UnpluginInstance } from 'unplugin'
import type { PluginOptions } from './types'

const debug = createDebug(resolveNamespace('root'))

export * from './types'

export const unpluginFactory: UnpluginFactory<PluginOptions | undefined> = (options = {}, meta) => {
  debug('meta framework', meta.framework)
  // check bundler type
  if (!['vite', 'webpack', 'rspack'].includes(meta.framework)) {
    raiseError(`This plugin is supported 'vite', 'webpack' and 'rspack' only`)
  }

  debug('plugin options (resolving):', options)
  const resolvedOptions = resolveOptions(options)
  debug('plugin options (resolved):', resolvedOptions)

  const plugins = [resourcePlugin(resolvedOptions, meta)]
  if (resolvedOptions.optimizeTranslationDirective) {
    if (meta.framework === 'webpack' || meta.framework === 'rspack') {
      raiseError(
        `The 'optimizeTranslationDirective' option still is not supported for ${meta.framework}.\n` +
          `We are waiting for your Pull Request 🙂.`
      )
    }
    plugins.push(directivePlugin(resolvedOptions))
  }

  return plugins
}

export const unplugin: UnpluginInstance<PluginOptions | undefined, boolean> =
  /* #__PURE__ */ createUnplugin(unpluginFactory)

export default unplugin
