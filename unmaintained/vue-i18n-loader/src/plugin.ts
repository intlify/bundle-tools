;(async () => {
  if (process.env.NODE_ENV !== 'test') {
    try {
      await import('vue-i18n')
    } catch (e) {
      throw new Error(
        '@intlify/vue-i18n-loader requires vue-i18n to be present in the dependency tree.'
      )
    }
  }
})()

import webpack from 'webpack'

declare class IntlifyVuePlugin {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(optoins: Record<string, any>)
  apply(compiler: webpack.Compiler): void
}

let Plugin: typeof IntlifyVuePlugin

console.warn(
  `[@intlify/vue-i18n-loader] IntlifyVuePlugin is experimental! This plugin is used for Intlify Devtools. Don't use this plugin to enhancement Component options of your application.`
)
// console.log('[@intlify/vue-i18n-loader] webpack version:', webpack.version)

if (webpack.version && webpack.version[0] > '4') {
  // webpack5 and upper
  Plugin = require('./pluginWebpack5').default // eslint-disable-line @typescript-eslint/no-var-requires
} else {
  // webpack4 and lower
  throw new Error(
    '[@intlify/vue-i18n-loader] webpack4 and lower is not supported!'
  )
  // Plugin = require('./pluginWebpack4').default // eslint-disable-line @typescript-eslint/no-var-requires
}

export default Plugin
