import { readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { defineBuildConfig } from 'unbuild'

const lib = fileURLToPath(new URL('./lib', import.meta.url))

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
  externals: ['vite', 'webpack'],
  hooks: {
    'build:done': async () => {
      await Promise.all([
        rm(resolve(lib, 'types.cjs')),
        rm(resolve(lib, 'types.mjs')),
        ...['vite', 'webpack'].map(async name => {
          for (const ext of ['d.ts', 'd.cts']) {
            const path = resolve(lib, `${name}.${ext}`)
            const content = await readFile(path, 'utf-8')
            await writeFile(
              path,
              content.replace(
                `export { ${name} as default };`,
                `export = ${name};`
              ),
              { encoding: 'utf-8' }
            )
          }
        })
      ])
    }
  }
})
