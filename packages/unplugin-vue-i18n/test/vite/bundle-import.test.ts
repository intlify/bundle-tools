import { resolve } from 'pathe'
import { bundleVite, bundleAndRun } from '../utils'
import { createMessageContext } from '@intlify/core-base'
;[
  {
    testcase: 'import',
    input: './fixtures/bundle-messages.ts',
    fixture: '@intlify/unplugin-vue-i18n/messages'
  },
  {
    testcase: 'deprected import id',
    input: './fixtures/bundle-messages-deprecated.ts',
    fixture: '@intlify/vite-plugin-vue-i18n/messages'
  }
].forEach(({ testcase, input, fixture }) => {
  test(testcase, async () => {
    const options = {
      input,
      strictMessage: false,
      include: [resolve(__dirname, '../fixtures/locales/**')]
    }
    const { exports: messages } = await bundleAndRun(
      fixture,
      bundleVite,
      options
    )
    ;['en', 'fr', 'ja', 'ko'].forEach(locale => {
      const fn = messages[locale].message
      expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
    })
  })
})
