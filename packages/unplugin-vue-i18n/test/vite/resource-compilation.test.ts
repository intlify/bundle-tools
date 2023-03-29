import { vi } from 'vitest'
import { resolve } from 'pathe'
import { bundleVite, bundleAndRun } from '../utils'
import { isFunction, assign } from '@intlify/shared'
import { createMessageContext } from '@intlify/core-base'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let spyConsoleError: any
beforeEach(() => {
  spyConsoleError = vi
    .spyOn(global.console, 'error')
    .mockImplementation(() => {}) // eslint-disable-line @typescript-eslint/no-empty-function
})

afterEach(() => {
  spyConsoleError.mockReset()
  spyConsoleError.mockRestore()
})

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

test('strict message', async () => {
  let occured = false
  try {
    await bundleAndRun('html.json', bundleVite, {
      ...options
    })
  } catch (e) {
    occured = true
  }
  expect(occured).toBe(true)
})

test('escape message', async () => {
  const { module } = await bundleAndRun(
    'html.json',
    bundleVite,
    assign(options, {
      strictMessage: false,
      escapeHtml: true
    })
  )
  expect(module.hi(createMessageContext())).toBe(`&lt;p&gt;hi there!&lt;/p&gt;`)
  expect(module.alert(createMessageContext())).toBe(
    `&lt;script&gt;window.alert(&apos;hi there!&apos;)&lt;/script&gt;`
  )
})
