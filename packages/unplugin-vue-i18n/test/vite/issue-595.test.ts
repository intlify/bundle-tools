import type { MessageCompilerContext } from '@intlify/core-base'
import { compile, createMessageContext } from '@intlify/core-base'
import { expect, test } from 'vitest'
import { bundleAndRun, bundleVite } from '../utils'

// https://github.com/intlify/bundle-tools/issues/595
// Vite 8 virtualizes lang=json5 SFC blocks; sidecar src must resolve
// relative to the SFC directory (not cwd), and virtual ids must not use NUL.
test('issue #595: SFC i18n sidecar with lang=json5 on Vite 8', async () => {
  const { module } = await bundleAndRun('nested/issue-595.vue', bundleVite)
  expect(module.__i18n).toBeDefined()

  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  const fn = compile(i18n.resource.en.hello, {} as MessageCompilerContext)
  expect(fn(createMessageContext())).toEqual('hello from sidecar')
})
