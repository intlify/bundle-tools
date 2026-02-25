<template>
  <p>{{ $t('hello') }}</p>
  <p>{{ $t(dynamicKey) }}</p>
</template>
<script>
export default {
  data() {
    return { dynamicKey: 'hello' }
  }
}
</script>
