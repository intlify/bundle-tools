import { createVitePlugin } from 'unplugin'
import { unpluginFactory } from '.'

import type { UnpluginInstance } from 'unplugin'
import type { PluginOptions } from './types'

const vite: UnpluginInstance<PluginOptions | undefined, boolean>['vite'] =
  createVitePlugin(unpluginFactory)

export default vite
