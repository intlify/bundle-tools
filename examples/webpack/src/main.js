import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import App from './App.vue'

import ja from './locales/ja.json'
import en from './locales/en.yaml'

const i18n = createI18n({
  locale: 'ja',
  messages: {
    en,
    ja
  }
})

const app = createApp(App)

app.use(i18n)
app.mount('#app')
