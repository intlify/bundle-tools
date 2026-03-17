import { isFunction } from '@intlify/shared'
import { expect, test } from 'vitest'
import { bundleAndRun, bundleVite } from '../utils'

// https://github.com/intlify/bundle-tools/issues/548
// SFC <i18n lang="js"> with arrow function closures fails with
// "Unexpected flow-map-start at node end" because the plugin
// routes lang="js" to the YAML generator instead of the JS generator.
test('issue #548: SFC i18n custom block with lang="js" and closure', async () => {
  const { module } = await bundleAndRun('issue-548.vue', bundleVite, {
    allowDynamic: true
  })
  expect(module.__i18n).toBeDefined()
  const i18n = module.__i18n.pop()
  expect(i18n.locale).toEqual('')
  // The closure should be preserved as a function
  expect(isFunction(i18n.resource.en.greeting)).toBe(true)
})
