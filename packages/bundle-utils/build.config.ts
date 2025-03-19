import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  outDir: 'lib',
  entries: [
    {
      name: 'index',
      input: 'src/index'
    }
  ],
  rollup: {
    emitCJS: true
  },
  externals: [
    'estree',
    'oxc-parser',
    '@oxc-parser/binding-wasm32-wasi',
    'oxc-transform',
    '@oxc-transform/binding-wasm32-wasi'
  ]
})
