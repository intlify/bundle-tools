import fs from 'node:fs'
import os from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import webpack from 'webpack'
import vueI18n from '../../src/webpack'

// a 1x1 PNG: its bytes are not valid UTF-8
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

function write(path: string, content: string | Buffer) {
  fs.mkdirSync(dirname(path), { recursive: true })
  fs.writeFileSync(path, content)
}

function build(config: webpack.Configuration): Promise<webpack.Stats> {
  return new Promise((resolve, reject) => {
    webpack(
      { mode: 'production', devtool: false, optimization: { minimize: false }, ...config },
      (err, stats) => {
        if (err) reject(err)
        else if (!stats) reject(new Error('webpack returned no stats'))
        else resolve(stats)
      }
    )
  })
}

let base: string | undefined

afterEach(() => {
  if (base) fs.rmSync(base, { recursive: true, force: true })
  base = undefined
})

// The transform loader of a webpack plugin passes the module source through as a string, so a binary
// asset that it is put on comes out with its bytes changed
test('webpack emits binary assets as they are', { timeout: 60_000 }, async () => {
  base = fs.realpathSync(fs.mkdtempSync(join(os.tmpdir(), 'unplugin-vue-i18n-assets-')))
  write(join(base, 'src/locales/en.json'), JSON.stringify({ hello: 'hello' }))
  write(join(base, 'src/logo.png'), PNG)
  write(
    join(base, 'src/main.js'),
    "import logo from './logo.png'\nimport en from './locales/en.json'\nconsole.log(logo, en)\n"
  )

  const stats = await build({
    context: base,
    entry: './src/main.js',
    output: { path: join(base, 'dist'), assetModuleFilename: '[name][ext]' },
    module: { rules: [{ test: /\.png$/, type: 'asset/resource' }] },
    plugins: [vueI18n({ include: [join(base, 'src/locales/**')] })]
  })

  expect(stats.hasErrors()).toBe(false)
  expect(fs.readFileSync(join(base, 'dist/logo.png')).equals(PNG)).toBe(true)
})

// html-webpack-plugin renders its template only when no other loader is on it (#322). A loader of
// the test reports the other loaders on a module that this plugin does not transform
test(
  'webpack puts no loader of this plugin on a module it does not transform',
  { timeout: 60_000 },
  async () => {
    base = fs.realpathSync(fs.mkdtempSync(join(os.tmpdir(), 'unplugin-vue-i18n-loaders-')))
    write(
      join(base, 'report-loaders.cjs'),
      'module.exports = function () {\n' +
        '  const others = this.loaders.filter(loader => loader.normal !== module.exports)\n' +
        "  return 'export default ' + JSON.stringify({ reportedBy: 'report-loaders', others: others.map(loader => loader.path) })\n" +
        '}\n'
    )
    write(join(base, 'src/locales/en.json'), JSON.stringify({ hello: 'hello' }))
    write(join(base, 'src/note.txt'), 'hello')
    write(
      join(base, 'src/main.js'),
      "import loaders from './note.txt'\nimport en from './locales/en.json'\nconsole.log(loaders, en)\n"
    )

    const stats = await build({
      context: base,
      entry: './src/main.js',
      output: { path: join(base, 'dist') },
      module: { rules: [{ test: /\.txt$/, use: [join(base, 'report-loaders.cjs')] }] },
      plugins: [vueI18n({ include: [join(base, 'src/locales/**')] })]
    })

    expect(stats.hasErrors()).toBe(false)
    const code = fs.readFileSync(join(base, 'dist/main.js'), 'utf8')
    expect(code).toContain('report-loaders') // the loader of the test ran
    expect(code).not.toMatch(/unplugin[\\/]dist[\\/]webpack[\\/]loaders/)
  }
)
