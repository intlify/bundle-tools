import type { KnipConfig } from 'knip'

export default {
  ignore: ['**/fixtures/**', '.unmaintained/**'],
  ignoreDependencies: ['ts-loader', 'lint-staged'],
  exclude: ['optionalPeerDependencies', 'unlisted', 'catalog']
} satisfies KnipConfig
