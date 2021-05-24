import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueI18n from '../src/index'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        composition: path.resolve(__dirname, './composition/index.html'),
        global: path.resolve(__dirname, './global/index.html'),
        legacy: path.resolve(__dirname, './legacy/index.html')
      }
    }
  },
  plugins: [
    vue(),
    vueI18n({
      include: path.resolve(__dirname, './**/locales/**'),
      compositionOnly: false
    })
  ]
})
