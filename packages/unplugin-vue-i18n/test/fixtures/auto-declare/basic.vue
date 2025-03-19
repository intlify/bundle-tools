<script lang="ts" setup>
const something = computed(() => $t('hello'))
</script>

<template>
	<div>{{ something }}</div>
</template>
