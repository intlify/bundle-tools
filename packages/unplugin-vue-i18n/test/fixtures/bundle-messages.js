import messages from '@intlify/unplugin-vue-i18n/messages'

if (typeof window !== 'undefined') {
  window.module = messages
  window.exports = messages
}
