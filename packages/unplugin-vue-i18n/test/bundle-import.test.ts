import { resolve } from 'pathe'
import { bundleAndRun, getCurrentTestBundler, isTestFramework } from './utils'
import { createMessageContext, compile } from '@intlify/core-base'
import { expect, test } from 'vitest'
import type { MessageCompilerContext } from '@intlify/core-base'
;[
  {
    testcase: 'import',
    input: './fixtures/bundle-messages.ts',
    fixture: '@intlify/unplugin-vue-i18n/messages'
  }
].forEach(({ testcase, input, fixture }) => {
  test.skipIf(!isTestFramework('vite'))(testcase, async () => {
    const options = {
      input,
      strictMessage: false,
      include: [resolve(__dirname, './fixtures/locales/**')]
    }
    const { exports: messages } = await bundleAndRun(
      fixture,
      getCurrentTestBundler(),
      options
    )
    ;['en', 'fr', 'ja', 'ko'].forEach(locale => {
      const fn = compile(messages[locale].message, {} as MessageCompilerContext)
      expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
    })
  })
})
