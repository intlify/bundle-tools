import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@intlify/message-compiler':
        '@intlify/message-compiler/dist/message-compiler.node.mjs'
    }
  },
  test: {
    globals: true
  }
})
