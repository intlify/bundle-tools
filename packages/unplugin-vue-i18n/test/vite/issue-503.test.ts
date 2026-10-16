import { resolve } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { bundleAndRun, bundleVite } from '../utils'

// v11 bundles only JSON / YAML resources into `@intlify/unplugin-vue-i18n/messages`, so JS / TS
// files under `include` were left out of it without a word. The plugin now warns about them
// (#503); the bundle itself is the same as before.
const NOT_BUNDLED = 'are not bundled into `@intlify/unplugin-vue-i18n/messages`'

let spyConsoleWarn: any
beforeEach(() => {
  spyConsoleWarn = vi.spyOn(global.console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  spyConsoleWarn.mockReset()
  spyConsoleWarn.mockRestore()
})

function notBundledWarnings(): string[] {
  return (spyConsoleWarn.mock.calls as unknown[][])
    .map(args => args.map(String).join(' '))
    .filter(message => message.includes(NOT_BUNDLED))
}

test('warns once about JS / TS files under include that the messages bundle leaves out', async () => {
  const { exports: messages } = await bundleAndRun(
    '@intlify/unplugin-vue-i18n/messages',
    bundleVite,
    {
      input: './fixtures/bundle-messages.ts',
      strictMessage: false,
      include: [resolve(__dirname, '../fixtures/locales/**')]
    }
  )
  // the bundle is unchanged: the JSON / YAML locales are in it, the JS / TS ones are not
  expect(messages.ja).toBeDefined()
  expect(messages['en-GB']).toBeUndefined()

  const warnings = notBundledWarnings()
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toContain('en-GB.ts')
  expect(warnings[0]).toContain('en-US.js')
})

test('does not warn when include has only JSON / YAML files', async () => {
  await bundleAndRun('@intlify/unplugin-vue-i18n/messages', bundleVite, {
    input: './fixtures/bundle-messages.ts',
    strictMessage: false,
    include: [resolve(__dirname, '../fixtures/locales/*.{json,json5,yml,yaml}')]
  })
  expect(notBundledWarnings()).toHaveLength(0)
})
