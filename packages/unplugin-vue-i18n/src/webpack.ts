import { createWebpackPlugin } from 'unplugin'
import { unpluginFactory } from '.'

import type { UnpluginInstance } from 'unplugin'
import type { PluginOptions } from './types'

const webpack: UnpluginInstance<PluginOptions | undefined, boolean>['webpack'] =
  createWebpackPlugin(unpluginFactory)
export default webpack
