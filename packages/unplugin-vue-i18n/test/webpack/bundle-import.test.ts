import { createMessageContext } from '@intlify/core-base'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { bundleAndRun, bundleWebpack } from '../utils'
;[
  {
    testcase: 'import',
    input: './fixtures/bundle-messages.ts',
    fixture: '@intlify/unplugin-vue-i18n/messages'
  }
].forEach(({ testcase, input, fixture }) => {
  test.skip(testcase, async () => {
    const options = {
      input,
      include: [resolve(__dirname, '../fixtures/locales/**')]
    }
    const { exports: messages } = await bundleAndRun(
      fixture,
      bundleWebpack,
      options
    )
    ;['en', 'fr', 'ja', 'ko'].forEach(locale => {
      const fn = messages[locale].message
      expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
    })
  })
})
