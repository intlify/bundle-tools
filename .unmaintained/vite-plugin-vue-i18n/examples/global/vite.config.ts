import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueI18n from '../../src/index'

export default defineConfig({
  plugins: [
    vue(),
    vueI18n({
      compositionOnly: true
    })
  ]
})
