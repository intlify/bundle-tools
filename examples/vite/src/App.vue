<template>
  <form id="lang">
    <label>{{ t('language') }}</label>
    <select v-model="locale">
      <option value="en">en</option>
      <option value="ja">ja</option>
    </select>
  </form>
  <p id="msg">{{ t('hello') }}</p>
  <p id="custom-directive" v-t="'hi'"></p>
  <Banana />
  <Apple />
</template>

<script lang="ts">
import { useI18n } from 'vue-i18n'
import Apple from './Apple.vue'
import Banana from './Banana.vue'

export default {
  name: 'App',
  components: {
    Apple,
    Banana
  },
  setup() {
    const { t, locale } = useI18n({
      inheritLocale: true,
      useScope: 'local'
    })
    return { t, locale }
  }
}
</script>

<i18n lang="json">
{
  "en": {
    "language": "Language",
    "hello": "hello, world!",
    "hi": "Hi!"
  },
  "ja": {
    "language": "言語",
    "hello": "こんにちは、世界！",
    "hi": "やあ！"
  }
}
</i18n>
