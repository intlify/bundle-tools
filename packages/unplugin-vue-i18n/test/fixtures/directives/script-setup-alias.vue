<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const count = ref(0)
const { t: translation } = useI18n()
</script>

<template>
  <h1 v-t="'hello'"></h1>
  <p>{{ count }} {{ translation('hello') }}</p>
</template>
