<template>
  <form>
    <label>{{ $t('language') }}</label>
    <select v-model="$i18n.locale">
      <option value="en">en</option>
      <option value="ja">ja</option>
    </select>
  </form>
  <p>{{ $t('hello') }}</p>
  <Banana />
</template>

<script>
import Banana from './Banana.vue'

export default {
  name: 'App',
  components: {
    Banana
  }
}
</script>

<i18n>
{
  "en": {
    "language": "Language",
    "hello": "hello, world!"
  },
  "ja": {
    "language": "言語",
    "hello": "こんにちは、世界！"
  }
}
</i18n>
