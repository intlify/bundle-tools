import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { bundleAndRun, bundleVite } from '../utils'

describe('tree-shaking: standalone locale files', () => {
  const localeInclude = [resolve(__dirname, '../fixtures/locales/treeshaking-en.json')]

  test('removes unused keys from global locale file', async () => {
    // treeshaking.vue uses $t('hello') only
    // treeshaking-en.json has { hello, unused, other, nav.home, nav.about, nav.contact }
    const { code } = await bundleVite('treeshaking-en.json', {
      target: './fixtures/locales/',
      include: localeInclude,
      treeShaking: {
        // Scan the Vue file that only uses $t('hello')
        scanPatterns: [resolve(__dirname, '../fixtures/treeshaking.vue')]
      }
    })
    // 'hello' key should be in the output
    expect(code).toContain('hello!')
    // 'unused' and 'other' keys should be removed
    expect(code).not.toContain('this should be removed')
    expect(code).not.toContain('other message')
    // nested nav keys should be removed
    expect(code).not.toContain('About')
    expect(code).not.toContain('Contact')
  })

  test('keeps all keys when treeShaking is disabled', async () => {
    const { code } = await bundleVite('treeshaking-en.json', {
      target: './fixtures/locales/',
      include: localeInclude
      // treeShaking not set
    })
    // All keys should be present
    expect(code).toContain('hello!')
    expect(code).toContain('this should be removed')
    expect(code).toContain('other message')
    expect(code).toContain('Home')
    expect(code).toContain('About')
  })

  test('keep-all strategy preserves all keys when dynamic key detected', async () => {
    const { code } = await bundleVite('treeshaking-en.json', {
      target: './fixtures/locales/',
      include: localeInclude,
      treeShaking: {
        dynamicKeyStrategy: 'keep-all',
        // Scan file with dynamic key usage: $t(dynamicKey)
        scanPatterns: [resolve(__dirname, '../fixtures/treeshaking-dynamic.vue')]
      }
    })
    // Dynamic key detected → all keys preserved
    expect(code).toContain('hello!')
    expect(code).toContain('this should be removed')
    expect(code).toContain('other message')
  })

  test('ignore strategy removes unused keys despite dynamic keys', async () => {
    const { code } = await bundleVite('treeshaking-en.json', {
      target: './fixtures/locales/',
      include: localeInclude,
      treeShaking: {
        dynamicKeyStrategy: 'ignore',
        scanPatterns: [resolve(__dirname, '../fixtures/treeshaking-dynamic.vue')]
      }
    })
    // Static key 'hello' should remain
    expect(code).toContain('hello!')
    // Unused keys should be removed despite dynamic usage
    expect(code).not.toContain('this should be removed')
    expect(code).not.toContain('other message')
  })

  test('safelist preserves matching keys', async () => {
    const { code } = await bundleVite('treeshaking-en.json', {
      target: './fixtures/locales/',
      include: localeInclude,
      treeShaking: {
        safelist: ['other', 'nav.*'],
        scanPatterns: [resolve(__dirname, '../fixtures/treeshaking.vue')]
      }
    })
    // 'hello' is used in template
    expect(code).toContain('hello!')
    // 'other' is in safelist
    expect(code).toContain('other message')
    // 'nav.*' matches nav.home, nav.about, nav.contact
    expect(code).toContain('Home')
    expect(code).toContain('About')
    expect(code).toContain('Contact')
    // 'unused' is not in safelist and not used
    expect(code).not.toContain('this should be removed')
  })
})

describe('tree-shaking: SFC custom blocks', () => {
  test('filters unused keys from <i18n global> block', async () => {
    // Scan treeshaking.vue which uses $t('hello') to determine used keys
    const { module } = await bundleAndRun('treeshaking-global.vue', bundleVite, {
      treeShaking: {
        scanPatterns: [resolve(__dirname, '../fixtures/treeshaking.vue')]
      }
    })
    // global blocks use __i18nGlobal, not __i18n
    expect(module.__i18nGlobal).toBeDefined()
    const i18n = module.__i18nGlobal.pop()
    expect(i18n.resource.en.hello).toBeDefined()
    expect(i18n.resource.en.unused).toBeUndefined()
    expect(i18n.resource.en.other).toBeUndefined()
  })

  test('preserves all keys in component-scoped <i18n> block', async () => {
    const { module } = await bundleAndRun('treeshaking-local.vue', bundleVite, {
      treeShaking: {
        scanPatterns: [resolve(__dirname, '../fixtures/treeshaking-local.vue')]
      }
    })
    const i18n = module.__i18n.pop()
    // Component scope: all keys should be preserved regardless of usage
    expect(i18n.resource.en.hello).toBeDefined()
    expect(i18n.resource.en.notUsedInTemplate).toBeDefined()
  })
})
