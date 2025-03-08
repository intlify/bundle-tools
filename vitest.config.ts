import { basename, dirname, join } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@intlify/message-compiler':
        '@intlify/message-compiler/dist/message-compiler.node.mjs'
    }
  },
  test: {
    globals: true,
    resolveSnapshotPath(testPath, extension) {
      const framework = '.' + process.env.TEST_FRAMEWORK || 'vite'
      return join(
        join(dirname(testPath), '__snapshots__'),
        `${basename(testPath)}${framework}${extension}`
      )
    }
  }
})
