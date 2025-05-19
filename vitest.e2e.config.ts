import path from 'node:path'
import { UserConfig } from 'vitest/config'

const __dirname = path.dirname(new URL('.', import.meta.url).pathname)

export default {
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./scripts/vitest.setup.ts'],
    include: ['./e2e/**/*.spec.ts']
    // maxWorkers: 1,
    // minWorkers: 1
  }
} satisfies UserConfig
