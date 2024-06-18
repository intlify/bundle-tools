<script>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

export default {
  setup() {
    const count = ref(0)
    const { t } = useI18n()
    return { count, translation: t }
  }
}
</script>

<template>
  <h1 v-t="'hello'"></h1>
  <p>{{ count }} {{ translation('hello') }}</p>
</template>
