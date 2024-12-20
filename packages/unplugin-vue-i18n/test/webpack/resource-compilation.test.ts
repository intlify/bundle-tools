import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { bundleWebpack, bundleAndRun } from '../utils'
import { createMessageContext, compile } from '@intlify/core-base'
import type { MessageCompilerContext } from '@intlify/core-base'
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
