import type { MessageCompilerContext } from '@intlify/core-base'
import { compile, createMessageContext } from '@intlify/core-base'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { bundleAndRun, bundleVite } from '../utils'

function bundleMessages(include: string, options: Record<string, unknown> = {}) {
  return bundleAndRun('@intlify/unplugin-vue-i18n/messages', bundleVite, {
    input: './fixtures/bundle-messages.ts',
    include: [resolve(__dirname, include)],
    ...options
  })
}

test('empty locale resource is treated as an empty object', async () => {
  // https://github.com/intlify/bundle-tools/issues/374
  const { exports: messages } = await bundleMessages('../fixtures/locales-empty/**')
  expect(messages.ja).toEqual({})

  const fn = compile(messages.en.hello, {} as MessageCompilerContext)
  expect(fn(createMessageContext())).toEqual('hello')
})

test('empty locale resource is treated as an empty object with treeShaking', async () => {
  const { exports: messages } = await bundleMessages('../fixtures/locales-empty/**', {
    treeShaking: {
      // treeshaking.vue uses $t('hello') only
      scanPatterns: [resolve(__dirname, '../fixtures/treeshaking.vue')]
    }
  })
  expect(messages.ja).toEqual({})

  const fn = compile(messages.en.hello, {} as MessageCompilerContext)
  expect(fn(createMessageContext())).toEqual('hello')
})

test('non-object locale resource fails the build with the file name', async () => {
  await expect(bundleMessages('../fixtures/locales-scalar/**')).rejects.toThrowError(
    /but got a string in .*locales-scalar\/ja\.yaml/
  )
})

test('empty i18n custom block is treated as an empty object', async () => {
  const { module } = await bundleAndRun('root-empty.vue', bundleVite)
  expect(module.__i18n.pop().resource).toEqual({})
})

test('null i18n custom block is treated as an empty object', async () => {
  const { module } = await bundleAndRun('root-null.vue', bundleVite)
  expect(module.__i18n.pop().resource).toEqual({})
})

test('array i18n custom block fails the build with the file name', async () => {
  await expect(bundleAndRun('root-array.vue', bundleVite)).rejects.toThrowError(
    /but got an array in the i18n custom block of .*root-array\.vue/
  )
})

test('i18n custom block with more than one yaml document fails the build', async () => {
  await expect(bundleAndRun('root-multi-doc.vue', bundleVite)).rejects.toThrowError(
    /but got 2 documents in the i18n custom block of .*root-multi-doc\.vue/
  )
})

test('onlyLocales keeps the messages of yaml that ends with an empty document', async () => {
  const { module } = await bundleAndRun('root-trailing-doc.vue', bundleVite, {
    onlyLocales: ['en']
  })

  const fn = compile(module.__i18n.pop().resource.en.hello, {} as MessageCompilerContext)
  expect(fn(createMessageContext())).toEqual('hello')
})
