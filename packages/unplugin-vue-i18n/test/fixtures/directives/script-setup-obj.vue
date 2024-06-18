<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const count = ref(0)
const i18n = useI18n()
</script>

<template>
  <h1 v-t="'hello'"></h1>
  <p>{{ count }} {{ i18n.t('hello') }}</p>
</template>
