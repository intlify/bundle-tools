import type { MessageCompilerContext } from '@intlify/core-base'
import { compile, createMessageContext } from '@intlify/core-base'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { bundleAndRun, bundleWebpack } from '../utils'
// import { VueLoaderPlugin } from 'vue-loader17'

const options = {
  target: './fixtures/locales',
  include: [resolve(__dirname, '../fixtures/locales/**')]
  // vueLoader: VueLoaderPlugin,
  // vueLoaderPath: resolve(
  //   __dirname,
  //   '../../../../node_modules/vue-loader17/dist/index.js'
  // )
}

test('json resource', async () => {
  const { module } = await bundleAndRun('ja.json', bundleWebpack, options)
  const fn = compile(module.message, {} as MessageCompilerContext)
  // expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`)
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
})

test('json5 resource', async () => {
  const { module } = await bundleAndRun('en.json5', bundleWebpack, options)
  const fn = compile(module.message, {} as MessageCompilerContext)
  // expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`)
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
})

test('yaml resource', async () => {
  const { module } = await bundleAndRun('ko.yaml', bundleWebpack, options)
  const fn = compile(module.message, {} as MessageCompilerContext)
  // expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`)
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
})

test('yml resource', async () => {
  const { module } = await bundleAndRun('fr.yml', bundleWebpack, options)
  const fn = compile(module.message, {} as MessageCompilerContext)
  // expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`)
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
})

test('ts resource', async () => {
  const { module } = await bundleAndRun('en-GB.ts', bundleWebpack, options)
  const fn = compile(module.message, {} as MessageCompilerContext)
  // expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`)
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
})

test('json that is not a locale resource', async () => {
  // `message.json` is outside `include`, so webpack reads it as JSON
  const { module } = await bundleAndRun('message.json', bundleWebpack, {
    include: [resolve(__dirname, '../fixtures/locales/**')]
  })
  expect(module).toEqual({ en: { hello: 'hello world!' } })
})

// a member of another locale module (#245), and a key from a constant
test('js resource whose values are not messages', async () => {
  const { module } = await bundleAndRun('en.js', bundleWebpack, {
    target: './fixtures/js-values/',
    include: [resolve(__dirname, '../fixtures/js-values/**')]
  })
  expect(compile(module.home.title, {} as MessageCompilerContext)(createMessageContext())).toBe(
    'Home'
  )
  expect(compile(module.title, {} as MessageCompilerContext)(createMessageContext())).toBe('Home')
  expect(compile(module.welcome, {} as MessageCompilerContext)(createMessageContext())).toBe(
    'Welcome'
  )
})
