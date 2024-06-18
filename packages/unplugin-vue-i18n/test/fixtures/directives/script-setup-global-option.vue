<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const count = ref(0)
const { t } = useI18n({
  useScope: 'global'
})
</script>

<template>
  <h1 v-t="'hello'"></h1>
  <p>{{ count }} {{ t('hello') }}</p>
</template>
