import type { KnipConfig } from 'knip'

export default {
  entry: [
    'scripts/playwright.ts' // jiti
  ],
  ignore: ['**/fixtures/**', '.unmaintained/**'],
  ignoreDependencies: ['ts-loader', 'lint-staged']
} satisfies KnipConfig
