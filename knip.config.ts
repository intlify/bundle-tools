import type { KnipConfig } from 'knip'

export default {
  entry: [
    'scripts/playwright.ts', // jiti
    'examples/rspack/rspack.config.mjs' // cannot resolve rspack plugin ...
  ],
  ignore: ['**/fixtures/**', '.unmaintained/**'],
  ignoreDependencies: ['ts-loader', 'lint-staged'],
  ignoreBinaries: ['dev']
} satisfies KnipConfig
