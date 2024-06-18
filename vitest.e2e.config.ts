import { UserConfig } from 'vitest/config'

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
