import type { KnipConfig } from 'knip'
export default {
  project: ['!unmaintained/**'],
  ignore: ['**/fixtures/**'],
  ignoreDependencies: ['@babel/preset-typescript']
} satisfies KnipConfig
