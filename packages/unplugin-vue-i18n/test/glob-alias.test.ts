import type { MessageCompilerContext } from '@intlify/core-base'

import { compile, createMessageContext } from '@intlify/core-base'
import { basename, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { bundleAndRun, getCurrentTestBundler, isTestFramework } from './utils'

const bundler = getCurrentTestBundler()
const include = [resolve(__dirname, './fixtures/locales-glob/**')]

// https://github.com/intlify/bundle-tools/issues/611
// Vite resolves a glob pattern with an alias through `resolveId`. A Vite 8 build
// passes with only a warning when the pattern is not resolved, so run the bundle.
async function bundleGlob(input: string) {
  const { module, jsdomError } = await bundleAndRun('locales-glob', bundler, { input, include })
  expect(jsdomError).toBeUndefined()

  // the keys are the paths of the matched files
  const messages: Record<string, any> = {}
  for (const [path, mod] of Object.entries<any>(module)) {
    messages[basename(path)] = mod.default
  }
  return messages
}

function render(message: any) {
  return compile(message, {} as MessageCompilerContext)(createMessageContext())
}

describe.skipIf(!isTestFramework('vite'))('import.meta.glob with an alias', () => {
  test('yaml', async () => {
    const messages = await bundleGlob('./fixtures/glob-alias.ts')
    expect(Object.keys(messages).sort()).toEqual(['en.yaml', 'ja.yaml'])
    expect(render(messages['en.yaml'].hello)).toEqual('hello')
    expect(render(messages['ja.yaml'].hello)).toEqual('こんにちは')
  })

  test('yaml with a negated pattern', async () => {
    const messages = await bundleGlob('./fixtures/glob-alias-negated.ts')
    expect(Object.keys(messages)).toEqual(['en.yaml'])
    expect(render(messages['en.yaml'].hello)).toEqual('hello')
  })

  test('json', async () => {
    const messages = await bundleGlob('./fixtures/glob-alias-json.ts')
    expect(Object.keys(messages).sort()).toEqual(['en.json', 'ja.json'])
    expect(render(messages['en.json'].hello)).toEqual('hello')
    expect(render(messages['ja.json'].hello)).toEqual('こんにちは')
  })
})
