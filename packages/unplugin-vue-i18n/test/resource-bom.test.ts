import type { MessageCompilerContext } from '@intlify/core-base'

import { compile, createMessageContext } from '@intlify/core-base'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { bundleAndRun, getCurrentTestBundler } from './utils'

const bundler = getCurrentTestBundler()

test('fixtures start with a BOM', () => {
  // editors may drop the BOM on save, because `.editorconfig` has `charset = utf-8`
  for (const file of ['./fixtures/locales-bom/ja.yaml', './fixtures/message-bom.yaml']) {
    const head = [...readFileSync(resolve(__dirname, file)).subarray(0, 3)]
    expect(head).toEqual([0xef, 0xbb, 0xbf])
  }
})

test('yaml locale resource with a BOM in messages', async () => {
  const { exports: messages } = await bundleAndRun('@intlify/unplugin-vue-i18n/messages', bundler, {
    input: './fixtures/bundle-messages.ts',
    include: [resolve(__dirname, './fixtures/locales-bom/**')]
  })

  const ja = compile(messages.ja.hello, {} as MessageCompilerContext)
  expect(ja(createMessageContext())).toEqual('こんにちは')
  const en = compile(messages.en.hello, {} as MessageCompilerContext)
  expect(en(createMessageContext())).toEqual('hello')
})

test('yaml locale resource with a BOM by import', async () => {
  const { module } = await bundleAndRun('ja.yaml', bundler, {
    target: './fixtures/locales-bom',
    include: [resolve(__dirname, './fixtures/locales-bom/**')]
  })

  const fn = compile(module.hello, {} as MessageCompilerContext)
  expect(fn(createMessageContext())).toEqual('こんにちは')
})

test('i18n custom block with a src yaml that has a BOM', async () => {
  const { module } = await bundleAndRun('import-bom.vue', bundler)

  const fn = compile(module.__i18n.pop().resource.en.hello, {} as MessageCompilerContext)
  expect(fn(createMessageContext())).toEqual('hello')
})
