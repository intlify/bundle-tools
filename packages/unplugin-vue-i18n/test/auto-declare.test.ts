import { parseAst } from 'rollup/dist/parseAst'
import { TransformResult } from 'unplugin'
import { describe, test } from 'vitest'
import { autoDeclarePlugin } from '../src/core/auto-declare'

function normalizeResult(val: TransformResult) {
  if (typeof val !== 'object' || val == null) {
    return { code: val || '', map: undefined }
  }

  return val
}

describe('inject destructured declaration', async () => {
  test('supports `$t`, `$n`, `$d`, `$te`, `$rt`, `$tm`', async () => {
    const plugin = autoDeclarePlugin({ sourcemap: false })
    const transformer = plugin.transform!.bind({ parse: parseAst } as any)
    const res = await transformer(
      [
        `<script setup>`,
        [
          `const stringTranslation = computed(() => $t('hello-world'))`,
          `const numberTranslation = computed(() => $n('some-number'))`,
          `const datetimeTranslation = computed(() => $d('some-date'))`,
          `const existingTranslation = computed(() => $te('message-key'))`,
          `const resolvedTranslation = computed(() => $rt($tm('maybe-an-array')[0]))`
        ].join('\n'),
        `</script>`
      ].join('\n'),
      'test-file.vue'
    )

    expect(normalizeResult(res).code).toMatchInlineSnapshot(`
      "<script setup>
      const { t: $t, n: $n, d: $d, te: $te, rt: $rt, tm: $tm } = useI18n()

      const stringTranslation = computed(() => $t('hello-world'))
      const numberTranslation = computed(() => $n('some-number'))
      const datetimeTranslation = computed(() => $d('some-date'))
      const existingTranslation = computed(() => $te('message-key'))
      const resolvedTranslation = computed(() => $rt($tm('maybe-an-array')[0]))
      </script>"
    `)
  })

  test('skips existing declarations', async () => {
    const plugin = autoDeclarePlugin({ sourcemap: false })
    const transformer = plugin.transform!.bind({ parse: parseAst } as any)
    const res = await transformer(
      [
        `<script setup>`,
        [
          `const { t: $t, d: $d } = useI18n({ useScope: 'local' })`,
          `const stringTranslation = computed(() => $t('hello-world'))`,
          `const numberTranslation = computed(() => $n('some-number'))`,
          `const datetimeTranslation = computed(() => $d('some-date'))`,
          `const existingTranslation = computed(() => $te('message-key'))`,
          `const resolvedTranslation = computed(() => $rt($tm('maybe-an-array')[0]))`
        ].join('\n'),
        `</script>`
      ].join('\n'),
      'test-file.vue'
    )

    expect(normalizeResult(res).code).toMatchInlineSnapshot(`
      "<script setup>
      const { n: $n, te: $te, rt: $rt, tm: $tm } = useI18n()

      const { t: $t, d: $d } = useI18n({ useScope: 'local' })
      const stringTranslation = computed(() => $t('hello-world'))
      const numberTranslation = computed(() => $n('some-number'))
      const datetimeTranslation = computed(() => $d('some-date'))
      const existingTranslation = computed(() => $te('message-key'))
      const resolvedTranslation = computed(() => $rt($tm('maybe-an-array')[0]))
      </script>"
    `)
  })
})

// })
