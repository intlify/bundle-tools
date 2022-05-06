import { resolve } from 'pathe'
import { createMessageContext } from '@intlify/core-base'
import { bundleWebpack, bundleAndRun } from '../utils'

test.skip('class component on resource files', async () => {
  const options = {
    useClassComponent: true,
    target: './fixtures/locales/',
    include: [resolve(__dirname, '../fixtures/locales/**')]
  }

  const { module } = await bundleAndRun('ja.json', bundleWebpack, options)
  expect(module.__o.__i18n).toMatchSnapshot()
  const i18n = module.__o.__i18n.pop()
  expect(i18n.locale).toEqual('')
  expect(i18n.resource.en.hello(createMessageContext())).toEqual('hello world!')
})

test.skip('class component on custom blocks', async () => {
  const options = {
    useClassComponent: true
  }
  const { module } = await bundleAndRun('basic.vue', bundleWebpack, options)
  expect(module.__o.__i18n).toMatchSnapshot()
  const i18n = module.__o.__i18n.pop()
  expect(i18n.locale).toEqual('')
  expect(i18n.resource.en.hello(createMessageContext())).toEqual('hello world!')
})
