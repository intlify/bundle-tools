import vueI18n from '@intlify/unplugin-vue-i18n/vite'
import vue from '@vitejs/plugin-vue'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function transformI18nBlock(source) {
  const sourceCopy = source
  const block = JSON.parse(sourceCopy.replace(/[\n\s]/g, '').replace(/,\]$/, ']'))
  if (Array.isArray(block)) {
    const transformedBlock = JSON.stringify({
      en: {
        language: 'Language',
        hello: 'hello, world!'
      },
      ja: {
        language: '言語',
        hello: 'こんにちは、世界！'
      }
    })
    return transformedBlock
  }
  return source
}

export default defineConfig({
  build: {
    outDir: path.resolve(__dirname, './dist'),
    rollupOptions: {
      input: path.resolve(__dirname, './index.html')
    }
  },
  plugins: [
    vue(),
    vueI18n({
      include: path.resolve(__dirname, './src/locales/**'),
      optimizeTranslationDirective: true,
      transformI18nBlock: transformI18nBlock
    })
  ]
})
