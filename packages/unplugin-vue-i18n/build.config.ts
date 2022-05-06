import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  outDir: 'lib',
  entries: [
    {
      name: 'index',
      input: 'src/index'
    },
    {
      name: 'types',
      input: 'src/types'
    },
    {
      name: 'vite',
      input: 'src/vite'
    },
    {
      name: 'webpack',
      input: 'src/webpack'
    }
  ],
  rollup: {
    emitCJS: true
  },
  externals: ['vite', 'webpack']
})
