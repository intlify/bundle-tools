import { expect, test } from 'vitest'
import { bundleVite, bundleAndRun } from '../utils'
import { createMessageContext, isMessageAST, compile } from '@intlify/core-base'
import type { MessageCompilerContext } from '@intlify/core-base'

test('basic', async () => {
  const { module } = await bundleAndRun('basic.vue', bundleVite)
  expect(module.__i18n).toMatchSnapshot()

  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  const fn = compile(i18n.resource.en.hello, {} as MessageCompilerContext)
  expect(fn(createMessageContext())).toEqual('hello world!')
})

test('json: exclude locales', async () => {
  const { module } = await bundleAndRun('basic.vue', bundleVite, {
    onlyLocales: ['ja']
  })
  expect(module.__i18n).toMatchSnapshot()

  const i18n = module.__i18n.pop()
  expect(i18n.resource.en).toBeUndefined()
})

test('yaml: exclude locales', async () => {
  const { module } = await bundleAndRun('yaml.vue', bundleVite, {
    onlyLocales: ['ja']
  })
  expect(module.__i18n).toMatchSnapshot()

  const i18n = module.__i18n.pop()
  expect(i18n.resource.en).toBeUndefined()
})

test('json5: exclude locales', async () => {
  const { module } = await bundleAndRun('json5.vue', bundleVite, {
    onlyLocales: ['ja']
  })
  expect(module.__i18n).toMatchSnapshot()

  const i18n = module.__i18n.pop()
  expect(i18n.resource.en).toBeUndefined()
})

test('json: exclude locales when using mixed locales', async () => {
  const { module } = await bundleAndRun('locale-mix-json.vue', bundleVite, {
    onlyLocales: ['en']
  })
  expect(module.__i18n).toMatchSnapshot()

  module.__i18n.forEach(i18n => {
    expect(i18n.resource.ja).toBeUndefined()
    expect(i18n.locale).not.toBe('ja')
  })
})

test('yaml: exclude locales when using mixed locales', async () => {
  const { module } = await bundleAndRun('locale-mix-yaml.vue', bundleVite, {
    onlyLocales: ['en']
  })
  expect(module.__i18n).toMatchSnapshot()

  module.__i18n.forEach(i18n => {
    expect(i18n.resource.ja).toBeUndefined()
    expect(i18n.locale).not.toBe('ja')
  })
})

test('json5: exclude locales when using mixed locales', async () => {
  const { module } = await bundleAndRun('locale-mix.vue', bundleVite, {
    onlyLocales: ['en']
  })
  expect(module.__i18n).toMatchSnapshot()

  module.__i18n.forEach(i18n => {
    expect(i18n.resource.ja).toBeUndefined()
    expect(i18n.locale).not.toBe('ja')
  })
})

test('yaml', async () => {
  const { module } = await bundleAndRun('yaml.vue', bundleVite)
  expect(module.__i18n).toMatchSnapshot()

  let i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('ja')
  const fn1 = compile(i18n.resource.hello, {
    locale: i18n.locale
  } as MessageCompilerContext)
  expect(fn1(createMessageContext())).toEqual('こんにちは、世界！')

  i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('en')
  const fn2 = compile(i18n.resource.hello, {
    locale: i18n.locale
  } as MessageCompilerContext)
  expect(fn2(createMessageContext())).toEqual('hello world!')
})

test('json5', async () => {
  const { module } = await bundleAndRun('json5.vue', bundleVite)
  expect(module.__i18n).toMatchSnapshot()

  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  const fn = compile(i18n.resource.en.hello, {} as MessageCompilerContext)
  expect(fn(createMessageContext())).toEqual('hello world!')
})

test('import', async () => {
  const { module } = await bundleAndRun('import.vue', bundleVite)
  expect(module.__i18n).toMatchSnapshot()

  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  const fn = compile(i18n.resource.en.hello, {} as MessageCompilerContext)
  expect(fn(createMessageContext())).toEqual('hello world!')
})

test('multiple', async () => {
  const { module } = await bundleAndRun('multiple.vue', bundleVite)
  expect(module.__i18n).toMatchSnapshot()
  expect(module.__i18n.length).toEqual(2)

  let i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  const fn1 = compile(i18n.resource.ja.hello, {} as MessageCompilerContext)
  expect(fn1(createMessageContext())).toEqual('こんにちは、世界！')

  i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  const fn2 = compile(i18n.resource.en.hello, {} as MessageCompilerContext)
  expect(fn2(createMessageContext())).toEqual('hello world!')
})

test('locale attr', async () => {
  const { module } = await bundleAndRun('locale.vue', bundleVite)
  expect(module.__i18n).toMatchSnapshot()

  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('ja')
  const fn = compile(i18n.resource.hello, {
    locale: i18n.locale
  } as MessageCompilerContext)
  expect(fn(createMessageContext())).toEqual('こんにちは、世界！')
})

test('locale attr and basic', async () => {
  const { module } = await bundleAndRun('locale-mix.vue', bundleVite)
  expect(module.__i18n).toMatchSnapshot()

  let i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('ja')
  const fn1 = compile(i18n.resource.hello, {
    locale: i18n.locale
  } as MessageCompilerContext)
  expect(fn1(createMessageContext())).toEqual('こんにちは、世界！')

  i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  const fn2 = compile(i18n.resource.en.hello, {} as MessageCompilerContext)
  expect(fn2(createMessageContext())).toEqual('hello world!')
})

test('locale attr and import', async () => {
  const { module } = await bundleAndRun('locale-import.vue', bundleVite)
  expect(module.__i18n).toMatchSnapshot()

  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('en')
  const fn = compile(i18n.resource.hello, {
    locale: i18n.locale
  } as MessageCompilerContext)
  expect(fn(createMessageContext())).toEqual('hello world!')
})

test('special characters', async () => {
  const { module } = await bundleAndRun('special-char.vue', bundleVite)
  expect(module.__i18n).toMatchSnapshot()

  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  const fn = compile(i18n.resource.en.hello, {} as MessageCompilerContext)
  expect(fn(createMessageContext())).toEqual('hello\ngreat\t"world"')
})

test('global', async () => {
  const { module } = await bundleAndRun('global-mix.vue', bundleVite)
  expect(module.__i18n).toMatchSnapshot()
  expect(module.__i18nGlobal).toMatchSnapshot()

  const l = module.__i18n.pop()
  expect(l.locale).toEqual('ja')
  const fn1 = compile(l.resource.hello, {
    locale: l.locale
  } as MessageCompilerContext)
  expect(fn1(createMessageContext())).toEqual('hello local!')

  const g = module.__i18nGlobal.pop()
  expect(g.locale).toEqual('')
  const fn2 = compile(g.resource.en.hello, {} as MessageCompilerContext)
  expect(fn2(createMessageContext())).toEqual('hello global!')
})

test('default lang', async () => {
  const { module } = await bundleAndRun('default-lang.vue', bundleVite, {
    defaultSFCLang: 'yml'
  })
  expect(module.__i18n).toMatchSnapshot()

  const l = module.__i18n.pop()
  const fn = compile(l.resource.en.hello, {} as MessageCompilerContext)
  expect(fn(createMessageContext())).toEqual('hello from defaults!')
})

test('default lang and global scope', async () => {
  const { module } = await bundleAndRun('default-lang.vue', bundleVite, {
    defaultSFCLang: 'yml',
    globalSFCScope: true
  })
  expect(module.__i18nGlobal).toMatchSnapshot()

  const g = module.__i18nGlobal.pop()
  const fn = compile(g.resource.en.hello, {} as MessageCompilerContext)
  expect(fn(createMessageContext())).toEqual('hello from defaults!')
})

test('global scope and import', async () => {
  const { module } = await bundleAndRun('global-scope-import.vue', bundleVite, {
    globalSFCScope: true
  })
  expect(module.__i18nGlobal).toMatchSnapshot()

  const g = module.__i18nGlobal.pop()
  const fn = compile(g.resource.en.hello, {} as MessageCompilerContext)
  expect(fn(createMessageContext())).toEqual('hello world!')
})

test('array', async () => {
  const { module } = await bundleAndRun('array.vue', bundleVite)
  expect(module.__i18n).toMatchSnapshot()

  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  const fn1 = compile(i18n.resource.en.foo[0][0], {} as MessageCompilerContext)
  const fn2 = compile(i18n.resource.en.foo[1], {} as MessageCompilerContext)
  expect(fn1(createMessageContext())).toEqual('bar')
  expect(fn2(createMessageContext())).toEqual('baz')
})

test('AST', async () => {
  const { module } = await bundleAndRun('basic.vue', bundleVite, {
    env: 'production'
  })
  expect(module.__i18n).toMatchSnapshot()

  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  expect(isMessageAST(i18n.resource.en.hello)).toBe(true)
})
