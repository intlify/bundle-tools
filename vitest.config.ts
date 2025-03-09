import { basename, dirname, join } from 'node:path'
import { defineConfig } from 'vitest/config'

const resolveSnapshotPath = (testPath, extension) => {
  // only split snapshots for unplugin-vue-i18n tests
  if (testPath.includes('unplugin-vue-i18n/test')) {
    const framework = '.' + process.env.TEST_FRAMEWORK || 'vite'
    return join(
      join(dirname(testPath), '__snapshots__'),
      `${basename(testPath)}${framework}${extension}`
    )
  }

  return join(
    join(dirname(testPath), '__snapshots__'),
    `${basename(testPath)}${extension}`
  )
}

export default defineConfig({
  resolve: {
    alias: {
      '@intlify/message-compiler':
        '@intlify/message-compiler/dist/message-compiler.node.mjs'
    }
  },
  test: {
    globals: true,
    resolveSnapshotPath
  }
})
