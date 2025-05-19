// import messages from '@intlify/unplugin-vue-i18n/messages'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import App from './App.vue'
import en from './locales/en.yaml'
import ja from './locales/ja.json'

const i18n = createI18n({
  locale: 'ja',
  messages: {
    ja,
    en
  }
})

const app = createApp(App)

app.use(i18n)
app.mount('#app')
