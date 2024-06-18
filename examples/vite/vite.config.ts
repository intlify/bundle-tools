import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueI18n from '../../packages/unplugin-vue-i18n/src/vite'

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
      optimizeTranslationDirective: true
    })
  ]
})
