import { createRspackPlugin } from 'unplugin'
import { unpluginFactory } from '.'

import type { UnpluginInstance } from 'unplugin'
import type { PluginOptions } from './types'

const rspack: UnpluginInstance<PluginOptions | undefined, boolean>['rspack'] =
  createRspackPlugin(unpluginFactory)
export default rspack
