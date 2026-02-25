import {
  analyzeVueSFC,
  extractKeysFromScript,
  extractKeysFromTemplate
} from '../src/core/key-analyzer'

describe('extractKeysFromScript', () => {
  test('extracts t() with string literal', async () => {
    const { keys, hasDynamic } = await extractKeysFromScript(`
      const { t } = useI18n()
      t('hello')
      t('nested.key')
    `)
    expect(keys).toContain('hello')
    expect(keys).toContain('nested.key')
    expect(hasDynamic).toBe(false)
  })

  test('extracts $t() calls', async () => {
    const { keys } = await extractKeysFromScript(`this.$t('greeting')`)
    expect(keys).toContain('greeting')
  })

  test('extracts tc, te functions', async () => {
    const { keys } = await extractKeysFromScript(`
      tc('plural.key')
      te('check.key')
    `)
    expect(keys).toContain('plural.key')
    expect(keys).toContain('check.key')
  })

  test('extracts d, n functions', async () => {
    const { keys } = await extractKeysFromScript(`
      d('date.format')
      n('number.format')
    `)
    expect(keys).toContain('date.format')
    expect(keys).toContain('number.format')
  })

  test('detects dynamic keys', async () => {
    const { keys, hasDynamic } = await extractKeysFromScript(`
      t('static.key')
      t(dynamicVariable)
    `)
    expect(keys).toContain('static.key')
    expect(hasDynamic).toBe(true)
  })

  test('extracts from template literal without expressions', async () => {
    const { keys } = await extractKeysFromScript('t(`static.template`)')
    expect(keys).toContain('static.template')
  })

  test('marks template literal with expressions as dynamic', async () => {
    const { hasDynamic } = await extractKeysFromScript('t(`prefix.${suffix}`)')
    expect(hasDynamic).toBe(true)
  })

  test('extracts from member expression: i18n.t()', async () => {
    const { keys } = await extractKeysFromScript(`i18n.t('member.key')`)
    expect(keys).toContain('member.key')
  })

  test('extracts from this.$t()', async () => {
    const { keys } = await extractKeysFromScript(`this.$t('options.api')`)
    expect(keys).toContain('options.api')
  })

  test('handles double quotes', async () => {
    const { keys } = await extractKeysFromScript(`t("double.quoted")`)
    expect(keys).toContain('double.quoted')
  })

  test('handles multiple calls in same line', async () => {
    const { keys } = await extractKeysFromScript(`
      const a = t('key1')
      const b = t('key2')
    `)
    expect(keys).toContain('key1')
    expect(keys).toContain('key2')
  })

  test('handles empty script', async () => {
    const { keys, hasDynamic } = await extractKeysFromScript('')
    expect(keys).toEqual([])
    expect(hasDynamic).toBe(false)
  })
})

describe('extractKeysFromTemplate', () => {
  test('extracts $t() from interpolation', () => {
    const { keys } = extractKeysFromTemplate(`
      <p>{{ $t('hello') }}</p>
      <span>{{ t('world') }}</span>
    `)
    expect(keys).toContain('hello')
    expect(keys).toContain('world')
  })

  test('extracts v-t directive (string)', () => {
    const { keys } = extractKeysFromTemplate(`<p v-t="'greeting'"></p>`)
    expect(keys).toContain('greeting')
  })

  test('extracts v-t directive (object path)', () => {
    const { keys } = extractKeysFromTemplate(`<p v-t="{path: 'nav.title'}"></p>`)
    expect(keys).toContain('nav.title')
  })

  test('extracts from bound attributes', () => {
    const { keys } = extractKeysFromTemplate(`<input :placeholder="$t('form.name')">`)
    expect(keys).toContain('form.name')
  })

  test('extracts with double quotes in t call', () => {
    const { keys } = extractKeysFromTemplate(`<p>{{ $t("double.quote") }}</p>`)
    expect(keys).toContain('double.quote')
  })

  test('handles empty template', () => {
    const { keys } = extractKeysFromTemplate('')
    expect(keys).toEqual([])
  })

  test('extracts multiple keys from complex template', () => {
    const { keys } = extractKeysFromTemplate(`
      <div>
        <h1>{{ $t('page.title') }}</h1>
        <p>{{ t('page.description') }}</p>
        <button>{{ $t('actions.submit') }}</button>
      </div>
    `)
    expect(keys).toContain('page.title')
    expect(keys).toContain('page.description')
    expect(keys).toContain('actions.submit')
  })

  test('detects dynamic key usage in template', () => {
    const { hasDynamic } = extractKeysFromTemplate(`
      <p>{{ $t('static') }}</p>
      <p>{{ $t(dynamicKey) }}</p>
    `)
    expect(hasDynamic).toBe(true)
  })

  test('no dynamic when all keys are static', () => {
    const { hasDynamic } = extractKeysFromTemplate(`
      <p>{{ $t('static') }}</p>
    `)
    expect(hasDynamic).toBe(false)
  })
})

describe('analyzeVueSFC', () => {
  test('extracts keys from both template and script', async () => {
    const result = await analyzeVueSFC(`
<template>
  <p>{{ $t('template.key') }}</p>
</template>
<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
t('script.key')
</script>
    `)
    expect(result.keys).toContain('template.key')
    expect(result.keys).toContain('script.key')
    expect(result.hasDynamic).toBe(false)
  })

  test('detects dynamic keys in SFC', async () => {
    const result = await analyzeVueSFC(`
<template>
  <p>{{ $t('static') }}</p>
</template>
<script setup>
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
const { t } = useI18n()
const key = ref('dynamic')
t(key.value)
</script>
    `)
    expect(result.keys).toContain('static')
    expect(result.hasDynamic).toBe(true)
  })

  test('handles SFC with template only', async () => {
    const result = await analyzeVueSFC(`
<template>
  <p>{{ $t('only.template') }}</p>
</template>
    `)
    expect(result.keys).toContain('only.template')
    expect(result.hasDynamic).toBe(false)
  })
})
