import { resolve } from 'pathe'
import { bundleAndRun, getCurrentTestBundler } from './utils'
import { createMessageContext, compile } from '@intlify/core-base'
import { describe, expect, test } from 'vitest'
import type { MessageCompilerContext } from '@intlify/core-base'
import fg from 'fast-glob'
import path from 'node:path'
// ;[
//   {
//     testcase: 'import',
//     input: './fixtures/bundle-messages.ts',
//     fixture: '@intlify/unplugin-vue-i18n/messages'
//   }
// ].forEach(({ testcase, input, fixture }) => {
const bundler = getCurrentTestBundler()
describe('auto declare', async () => {
  const fixtures = await fg(
    path.resolve(__dirname, './fixtures/auto-declare/*.vue')
  )

  fixtures.forEach(fixture => {
    const filename = path.basename(fixture)
    const basename = filename.replace(/\.vue$/, '')
    test(basename, async () => {
      const options = {
        target: './fixtures/auto-declare/'
        // strictMessage: false,
        // include: [resolve(__dirname, './fixtures/locales/**')]
      }
      const mod = await bundleAndRun(filename, bundler, options)
      console.log(mod.module)
      const renderString = mod.module.setup.toString() as string
      expect(renderString).toMatchInlineSnapshot(`
        "setup(__props, { expose: __expose }) {
            __expose();
            const { t: $t } = useI18n();
            const something = computed(() => $t("hello"));
            const __returned__ = { $t, something };
            Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
            return __returned__;
          }"
      `)

      // ;['en', 'fr', 'ja', 'ko'].forEach(locale => {
      //   const fn = compile(messages[locale].message, {} as MessageCompilerContext)
      //   expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`)
      // })
    })
  })
})
// })
