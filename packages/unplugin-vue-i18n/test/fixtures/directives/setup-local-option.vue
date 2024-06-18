<script>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

export default {
  setup() {
    const count = ref(0)
    const { t } = useI18n({
      useScope: 'local',
      messages: {
        en: {
          count: '{count} apple'
        }
      }
    })
    return { count, t }
  }
}
</script>

<template>
  <h1 v-t="{ path: 'count', named: { count } }"></h1>
  <p>{{ count }} {{ t('hello') }}</p>
</template>
