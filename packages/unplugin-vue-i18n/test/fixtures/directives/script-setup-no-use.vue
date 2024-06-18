<script setup>
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <h1 v-t="'hello'"></h1>
  <p>{{ count }}</p>
</template>
