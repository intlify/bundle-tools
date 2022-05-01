import { createUnplugin } from 'unplugin'

import type { PluginOptions } from './types'

export const unplugin = createUnplugin<PluginOptions>((options = {}) => {
  console.log("I've borned in the world!")
  return {
    name: 'unplugin-vue-i18n'
  }
})

export default unplugin
