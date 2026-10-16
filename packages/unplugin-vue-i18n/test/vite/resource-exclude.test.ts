import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { bundleAndRun, bundleVite } from '../utils'

const include = [resolve(__dirname, '../fixtures/locales/**')]

// `exclude` keeps a file under `include` away from the plugin: it is not compiled when it is
// imported directly (on Vite 6 / 7 as well as Vite 8), and it is not bundled into
// `@intlify/unplugin-vue-i18n/messages`.
test('an excluded resource is left to the bundler when imported directly', async () => {
  const { module } = await bundleAndRun('ja.json', bundleVite, {
    target: './fixtures/locales/',
    include,
    exclude: [resolve(__dirname, '../fixtures/locales/ja.json')]
  })
  // the bundler keeps the message as the raw string; the plugin would compile it to an AST
  expect(module.message).toBe(`@.caml:{'no apples'} | {0} apple | {n} apples`)
})

test('an excluded resource is not bundled into the messages module', async () => {
  const { exports: messages } = await bundleAndRun(
    '@intlify/unplugin-vue-i18n/messages',
    bundleVite,
    {
      input: './fixtures/bundle-messages.ts',
      strictMessage: false,
      include,
      exclude: [
        resolve(__dirname, '../fixtures/locales/ja.json'),
        resolve(__dirname, '../fixtures/locales/ko.*')
      ]
    }
  )
  expect(messages.ja).toBeUndefined()
  expect(messages.ko).toBeUndefined()
  expect(messages.fr).toBeDefined()
})
