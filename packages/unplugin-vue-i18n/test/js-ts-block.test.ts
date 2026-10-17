import type { MessageCompilerContext } from '@intlify/core-base'

import { compile, createMessageContext } from '@intlify/core-base'
import { expect, test } from 'vitest'
import { bundleAndRun, getCurrentTestBundler } from './utils'

const bundler = getCurrentTestBundler()

// a JS / TS block is a module, as a `src` file is, or only the object of the messages (#548)
test.each([
  ['a `src` file with `export default`', 'js-ts-src-ts.vue'],
  ['a `src` file that imports a module', 'js-ts-src-import-locale.vue'],
  ['an inline block with `export default`', 'js-ts-inline-export.vue'],
  ['an inline block with only the object, in TypeScript', 'js-ts-inline-as-const.vue']
])('JS / TS i18n block: %s', async (_name, fixture) => {
  const { module } = await bundleAndRun(fixture, bundler)
  const i18n = module.__i18n.pop()
  const fn = compile(i18n.resource.en.hello, {} as MessageCompilerContext)
  expect(fn(createMessageContext())).toBe('hello world!')
})
