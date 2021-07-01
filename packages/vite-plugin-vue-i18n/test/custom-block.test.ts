import { bundleAndRun } from './utils'
import { createMessageContext } from '@intlify/runtime'

test('basic', async () => {
  const { module } = await bundleAndRun('basic.vue')
  expect(module.__i18n).toMatchSnapshot()
  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  expect(i18n.resource.en.hello(createMessageContext())).toEqual('hello world!')
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

test('import', async () => {
  const { module } = await bundleAndRun('import.vue')
  expect(module.__i18n).toMatchSnapshot()
  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  expect(i18n.resource.en.hello(createMessageContext())).toEqual('hello world!')
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

test('special characters', async () => {
  const { module } = await bundleAndRun('special-char.vue')
  expect(module.__i18n).toMatchSnapshot()
  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  expect(i18n.resource.en.hello(createMessageContext())).toEqual(
    'hello\ngreat\t"world"'
  )
})

test('global', async () => {
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

test('default lang', async () => {
  const { module } = await bundleAndRun('default-lang.vue', {
    defaultSFCLang: 'yml'
  })
  expect(module.__i18n).toMatchSnapshot()
  const l = module.__i18n.pop()
  expect(l.resource.en.hello(createMessageContext())).toEqual(
    'hello from defaults!'
  )
})

test('default lang and global scope', async () => {
  const { module } = await bundleAndRun('default-lang.vue', {
    defaultSFCLang: 'yml',
    globalSFCScope: true
  })
  expect(module.__i18nGlobal).toMatchSnapshot()
  const g = module.__i18nGlobal.pop()
  expect(g.resource.en.hello(createMessageContext())).toEqual(
    'hello from defaults!'
  )
})

test('global scope and import', async () => {
  const { module } = await bundleAndRun('global-scope-import.vue', {
    globalSFCScope: true
  })
  expect(module.__i18nGlobal).toMatchSnapshot()
  const g = module.__i18nGlobal.pop()
  expect(g.resource.en.hello(createMessageContext())).toEqual('hello world!')
})
