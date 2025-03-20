import messages from '@intlify/vite-plugin-vue-i18n/messages'

if (typeof window !== 'undefined') {
  window.module = messages
  window.exports = messages
}
