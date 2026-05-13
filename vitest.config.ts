import { basename, dirname, join } from 'node:path'
import { defineConfig } from 'vitest/config'

const resolveSnapshotPath = (testPath: string, extension: string) => {
  // For vite tests, split snapshot files by TEST_VITE_TYPE so the per-bundler
  // sourcemap differences (rollup-vite vs rolldown / vite 8) do not collide.
  if (testPath.includes('unplugin-vue-i18n/test/vite/')) {
    const viteType = process.env.TEST_VITE_TYPE || 'vite8'
    return join(
      join(dirname(testPath), '__snapshots__'),
      `${basename(testPath)}.${viteType}${extension}`
    )
  }

  return join(join(dirname(testPath), '__snapshots__'), `${basename(testPath)}${extension}`)
}

export default defineConfig({
  resolve: {
    alias: {
      '@intlify/message-compiler': '@intlify/message-compiler/dist/message-compiler.node.mjs'
    }
  },
  test: {
    globals: true,
    resolveSnapshotPath
  }
})
