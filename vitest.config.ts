import { basename, dirname, join } from 'node:path'
import { defineConfig } from 'vitest/config'

const resolveSnapshotPath = (testPath, extension) => {
  // only split snapshots for unplugin-vue-i18n tests
  if (testPath.includes('unplugin-vue-i18n/test')) {
    const framework = process.env.TEST_FRAMEWORK || 'vite'
    // For vite, also split by TEST_VITE_TYPE (rolldown vs rollup) so the per-bundler
    // sourcemap differences don't collide on a single snapshot file.
    const suffix =
      framework === 'vite'
        ? `.${framework}.${process.env.TEST_VITE_TYPE || 'vite8'}`
        : `.${framework}`
    return join(
      join(dirname(testPath), '__snapshots__'),
      `${basename(testPath)}${suffix}${extension}`
    )
  }

  return join(join(dirname(testPath), '__snapshots__'), `${basename(testPath)}${extension}`)
}

export default defineConfig({
  resolve: {
    alias: {
      '@intlify/message-compiler': '@intlify/message-compiler/dist/message-compiler.node.js'
    }
  },
  test: {
    globals: true,
    resolveSnapshotPath
  }
})
