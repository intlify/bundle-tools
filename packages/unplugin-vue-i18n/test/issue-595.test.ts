import type { MessageCompilerContext } from '@intlify/core-base'

import { compile, createMessageContext } from '@intlify/core-base'
import { expect, test } from 'vitest'
import { bundleAndRun, getCurrentTestBundler } from './utils'

// https://github.com/intlify/bundle-tools/issues/595
// Vite 8 virtualizes SFC i18n blocks with lang=json / json5. The `src` of such
// a block must be resolved from the directory of the SFC, not from the cwd.
test('issue #595: SFC i18n block with src and lang=json5', async () => {
  const { module } = await bundleAndRun('nested/issue-595.vue', getCurrentTestBundler())
  expect(module.__i18n).toBeDefined()

  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  const fn = compile(i18n.resource.en.hello, {} as MessageCompilerContext)
  expect(fn(createMessageContext())).toEqual('hello from sidecar')
})
