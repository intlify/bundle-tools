import type { MessageCompilerContext } from '@intlify/core-base'
import { compile, createMessageContext } from '@intlify/core-base'
import { assign, isFunction } from '@intlify/shared'
import { resolve } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { bundleAndRun, bundleVite } from '../utils'
let spyConsoleError: any
beforeEach(() => {
  spyConsoleError = vi.spyOn(global.console, 'error').mockImplementation(() => {})
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
  const fn = compile(module.message, {} as MessageCompilerContext)
  // expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`)
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
})

test('json5 resource', async () => {
  const { module } = await bundleAndRun('en.json5', bundleVite, options)
  const fn = compile(module.message, {} as MessageCompilerContext)
  // expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`)
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
})

test('yaml resource', async () => {
  const { module } = await bundleAndRun('ko.yaml', bundleVite, options)
  const fn = compile(module.message, {} as MessageCompilerContext)
  // expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`)
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
})

test('yml resource', async () => {
  const { module } = await bundleAndRun('fr.yml', bundleVite, options)
  const fn = compile(module.message, {} as MessageCompilerContext)
  // expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`)
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
})

test('js resource', async () => {
  const { module } = await bundleAndRun('en-KK.mjs', bundleVite, options)
  const fn = compile(module.message, {} as MessageCompilerContext)
  // expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`)
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
})

test('ts resource', async () => {
  const { module } = await bundleAndRun('en-GB.ts', bundleVite, options)
  const fn = compile(module.message, {} as MessageCompilerContext)
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
  } catch (_e) {
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
  expect(compile(module.hi, {} as MessageCompilerContext)(createMessageContext())).toBe(
    `&lt;p&gt;hi there!&lt;/p&gt;`
  )
  expect(compile(module.alert, {} as MessageCompilerContext)(createMessageContext())).toBe(
    `&lt;script&gt;window.alert(&apos;hi there!&apos;)&lt;/script&gt;`
  )
})
