import { resolve } from 'pathe'
import { createMessageContext } from '@intlify/core-base'
import { bundleWebpack, bundleAndRun } from '../utils'
import { VueLoaderPlugin } from 'vue-loader15'

test('bridge', async () => {
  const options = {
    bridge: true,
    vueLoader: VueLoaderPlugin,
    vueLoaderPath: resolve(
      __dirname,
      '../../../../node_modules/vue-loader15/lib/index.js'
    )
  }
  const { module } = await bundleAndRun('compile.vue', bundleWebpack, options)
  expect(module.__i18n).toMatchSnapshot()
  expect(module.__i18nBridge).toMatchSnapshot()
  const l = module.__i18n.pop()
  expect(l.locale).toEqual('')
  expect(l.resource.en.hello(createMessageContext())).toEqual('hello world!')
  const g = module.__i18nBridge.pop()
  const bridgeResource = JSON.parse(g)
  expect(bridgeResource.en.hello).toEqual('hello world!')
})
