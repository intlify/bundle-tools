import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { bundleAndRun, getCurrentTestBundler } from './utils'

const include = [resolve(__dirname, './fixtures/locales/**')]

// `exclude` keeps a file under `include` away from the plugin: it is not compiled when it is
// imported directly, and it is not bundled into `@intlify/unplugin-vue-i18n/messages`. This works
// on v12 already; the test guards against a regression (v11 got it wrong on both counts).
test('an excluded resource is left to the bundler when imported directly', async () => {
  const { module } = await bundleAndRun('ja.json', getCurrentTestBundler(), {
    target: './fixtures/locales/',
    include,
    exclude: [resolve(__dirname, './fixtures/locales/ja.json')]
  })
  // the bundler keeps the message as the raw string; the plugin would compile it to an AST
  expect(module.message).toBe(`@.caml:{'no apples'} | {0} apple | {n} apples`)
})

test('an excluded resource is not bundled into the messages module', async () => {
  const { exports: messages } = await bundleAndRun(
    '@intlify/unplugin-vue-i18n/messages',
    getCurrentTestBundler(),
    {
      input: './fixtures/bundle-messages.ts',
      strictMessage: false,
      include,
      exclude: [
        resolve(__dirname, './fixtures/locales/ja.json'),
        resolve(__dirname, './fixtures/locales/ko.*')
      ]
    }
  )
  expect(messages.ja).toBeUndefined()
  expect(messages.ko).toBeUndefined()
  expect(messages.fr).toBeDefined()
})
