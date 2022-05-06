import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueI18n from '../../lib/vite.mjs'

export default defineConfig({
  resolve: {
    alias: {
      vue: path.resolve(
        __dirname,
        '../../../../node_modules/vue3/dist/vue.esm-bundler.js'
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
      include: path.resolve(__dirname, './src/locales/**')
    })
  ]
})
