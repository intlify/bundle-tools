import { bundleAndRun, bundle } from './utils'
import { createMessageContext } from '@intlify/core-base'
import { VueLoaderPlugin } from 'vue-loader15'
import path from 'path'

test('basic', async () => {
  const { module } = await bundleAndRun('basic.vue')
  expect(module.__i18n).toMatchSnapshot()
  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  expect(i18n.resource.en.hello(createMessageContext())).toEqual('hello world!')
})

test('special characters', async () => {
  const { module } = await bundleAndRun('special-char.vue')
  expect(module.__i18n).toMatchSnapshot()
  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  expect(i18n.resource.en.hello(createMessageContext())).toEqual(
    'hello\ngreat\t"world"'
  )
})

test('multiple', async () => {
  const { module } = await bundleAndRun('multiple.vue')
  expect(module.__i18n).toMatchSnapshot()
  expect(module.__i18n.length).toEqual(2)
  let i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  expect(i18n.resource.ja.hello(createMessageContext())).toEqual(
    'こんにちは、世界！'
  )
  i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  expect(i18n.resource.en.hello(createMessageContext())).toEqual('hello world!')
})

test('import', async () => {
  const { module } = await bundleAndRun('import.vue')
  expect(module.__i18n).toMatchSnapshot()
  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  expect(i18n.resource.en.hello(createMessageContext())).toEqual('hello world!')
})

test('locale attr', async () => {
  const { module } = await bundleAndRun('locale.vue')
  expect(module.__i18n).toMatchSnapshot()
  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('ja')
  expect(i18n.resource.hello(createMessageContext())).toEqual(
    'こんにちは、世界！'
  )
})

test('locale attr and basic', async () => {
  const { module } = await bundleAndRun('locale-mix.vue')
  expect(module.__i18n).toMatchSnapshot()
  let i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('ja')
  expect(i18n.resource.hello(createMessageContext())).toEqual(
    'こんにちは、世界！'
  )
  i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  expect(i18n.resource.en.hello(createMessageContext())).toEqual('hello world!')
})

test('locale attr and import', async () => {
  const { module } = await bundleAndRun('locale-import.vue')
  expect(module.__i18n).toMatchSnapshot()
  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('en')
  expect(i18n.resource.hello(createMessageContext())).toEqual('hello world!')
})

test('yaml', async () => {
  const { module } = await bundleAndRun('yaml.vue')
  expect(module.__i18n).toMatchSnapshot()
  let i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('ja')
  expect(i18n.resource.hello(createMessageContext())).toEqual(
    'こんにちは、世界！'
  )
  i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('en')
  expect(i18n.resource.hello(createMessageContext())).toEqual('hello world!')
})

test('json5', async () => {
  const { module } = await bundleAndRun('json5.vue')
  expect(module.__i18n).toMatchSnapshot()
  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  expect(i18n.resource.en.hello(createMessageContext())).toEqual('hello world!')
})

test('global', async () => {
  const { module } = await bundleAndRun('global.vue')
  expect(module.__i18n).toBeUndefined()
  expect(module.__i18nGlobal).toMatchSnapshot()
  const i18n = module.__i18nGlobal.pop()
  expect(i18n.locale).toEqual('')
  expect(i18n.resource.en.hello(createMessageContext())).toEqual(
    'hello global!'
  )
})

test('global and local', async () => {
  const { module } = await bundleAndRun('global-mix.vue')
  expect(module.__i18n).toMatchSnapshot()
  expect(module.__i18nGlobal).toMatchSnapshot()
  const l = module.__i18n.pop()
  expect(l.locale).toEqual('ja')
  expect(l.resource.hello(createMessageContext())).toEqual('hello local!')
  const g = module.__i18nGlobal.pop()
  expect(g.locale).toEqual('')
  expect(g.resource.en.hello(createMessageContext())).toEqual('hello global!')
})

test('bridge', async () => {
  const { module } = await bundleAndRun(
    'compile.vue',
    bundle,
    { bridge: true },
    {
      Plugin: VueLoaderPlugin,
      loader: path.resolve(
        __dirname,
        '../../../node_modules/vue-loader15/lib/index.js'
      )
    }
  )
  expect(module.__i18n).toMatchSnapshot()
  expect(module.__i18nBridge).toMatchSnapshot()
  const l = module.__i18n.pop()
  expect(l.locale).toEqual('')
  expect(l.resource.en.hello(createMessageContext())).toEqual('hello world!')
  const g = module.__i18nBridge.pop()
  const bridgeResource = JSON.parse(g)
  expect(bridgeResource.en.hello).toEqual('hello world!')
})
