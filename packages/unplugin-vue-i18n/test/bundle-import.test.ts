import type { MessageCompilerContext } from '@intlify/core-base'

import { compile, createMessageContext } from '@intlify/core-base'
import { resolve } from 'node:path'
import { expect, test, vi } from 'vitest'
import { bundleAndRun, getCurrentTestBundler, isTestFramework } from './utils'
;[
  {
    testcase: 'import',
    input: './fixtures/bundle-messages.ts',
    fixture: '@intlify/unplugin-vue-i18n/messages'
  }
].forEach(({ testcase, input, fixture }) => {
  // eslint-disable-next-line vitest/valid-title -- ignore
  test(testcase, async () => {
    const options = {
      input,
      strictMessage: false,
      include: [resolve(__dirname, './fixtures/locales/**')]
    }
    const { exports: messages } = await bundleAndRun(fixture, getCurrentTestBundler(), options)
    ;['en', 'fr', 'ja', 'ko'].forEach(locale => {
      const fn = compile(messages[locale].message, {} as MessageCompilerContext)
      expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
    })
  })
})

test.skipIf(!isTestFramework('vite'))('import with no matching resources', async () => {
  const spyConsoleWarn = vi.spyOn(global.console, 'warn').mockImplementation(() => {})
  try {
    const options = {
      input: './fixtures/bundle-messages.ts',
      include: [resolve(__dirname, './fixtures/no-locales/**')]
    }
    const { exports: messages } = await bundleAndRun(
      '@intlify/unplugin-vue-i18n/messages',
      getCurrentTestBundler(),
      options
    )
    expect(Object.keys(messages)).toEqual([])
    expect(spyConsoleWarn).toHaveBeenCalledWith(
      expect.anything(),
      '`@intlify/unplugin-vue-i18n/messages` is imported, but no locale resources match `include`'
    )
  } finally {
    spyConsoleWarn.mockRestore()
  }
})
