<template>
  <form id="fruits">
    <label>{{ t('select') }}</label>
    <select v-model.number="select">
      <option value="0">0</option>
      <option value="1">1</option>
      <option value="2">2</option>
      <option value="3">3</option>
    </select>
  </form>
  <p>{{ t('fruits.banana', select, { n: select }) }}</p>
</template>

<script lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export default {
  name: 'Banana',
  setup() {
    const { t, locale } = useI18n({ useScope: 'global' })
    watch(locale, (val, old) => {
      console.log('locale changed', val, old)
    })
    const select = ref(0)
    return { t, select }
  }
}
</script>
