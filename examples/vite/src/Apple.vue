<template>
  <p>{{ t('language') }}</p>
  <p>{{ t('hello') }}</p>
</template>

<script>
import { useI18n } from 'vue-i18n'

export default {
  name: 'Apple',
  setup() {
    const { t } = useI18n({
      inheritLocale: true,
      useScope: 'local'
    })
    return { t }
  }
}
</script>

<i18n>
[
  "language",
  "hello",
]
</i18n>
