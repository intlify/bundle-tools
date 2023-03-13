import { resolve } from 'pathe'
import { bundleVite, bundleAndRun } from '../utils'
import { isFunction } from '@intlify/shared'
import { createMessageContext } from '@intlify/core-base'

const options = {
  target: './fixtures/locales/',
  include: [resolve(__dirname, '../fixtures/locales/**')]
}

test('json resource', async () => {
  const { module } = await bundleAndRun('ja.json', bundleVite, options)
  const fn = module.message
  // expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`)
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
})

test('json5 resource', async () => {
  const { module } = await bundleAndRun('en.json5', bundleVite, options)
  const fn = module.message
  // expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`)
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
})

test('yaml resource', async () => {
  const { module } = await bundleAndRun('ko.yaml', bundleVite, options)
  const fn = module.message
  // expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`)
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
})

test('yml resource', async () => {
  const { module } = await bundleAndRun('fr.yml', bundleVite, options)
  const fn = module.message
  // expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`)
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
})

test('js resource', async () => {
  const { module } = await bundleAndRun('en-KK.mjs', bundleVite, options)
  const fn = module.message
  // expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`)
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
})

test('ts resource', async () => {
  const { module } = await bundleAndRun('en-GB.ts', bundleVite, options)
  const fn = module.message
  // expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`)
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
})

test('dynamical resource with js / ts', async () => {
  const { module } = await bundleAndRun('ka-JP.ts', bundleVite, {
    allowDynamic: true,
    ...options
  })
  expect(isFunction(module)).toBe(true)
})
