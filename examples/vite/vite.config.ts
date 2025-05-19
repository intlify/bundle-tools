import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueI18n from '../../packages/unplugin-vue-i18n/src/vite'

function transformI18nBlock(source) {
  const sourceCopy = source
  const block = JSON.parse(
    sourceCopy.replace(/[\n\s]/g, '').replace(/,\]$/, ']')
  )
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
  resolve: {
    alias: {
      vue: path.resolve(
        __dirname,
        '../../node_modules/vue/dist/vue.esm-bundler.js'
      )
    }
  },
  build: {
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
