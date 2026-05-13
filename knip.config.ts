import type { KnipConfig } from 'knip'

export default {
  ignore: ['**/fixtures/**', '.unmaintained/**'],
  ignoreDependencies: ['ts-loader', 'lint-staged'],
  exclude: ['optionalPeerDependencies', 'unlisted', 'catalog'],
  workspaces: {
    'examples/rspack': {
      entry: ['rspack.config.mjs', 'src/main.js']
    }
  }
} satisfies KnipConfig
