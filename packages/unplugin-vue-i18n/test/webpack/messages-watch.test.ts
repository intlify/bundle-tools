import fs from 'node:fs'
import os from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import webpack from 'webpack'
import vueI18n from '../../src/webpack'

const OLD = 'hello-old'
const NEW = 'hello-new'

function write(path: string, content: string) {
  fs.mkdirSync(dirname(path), { recursive: true })
  fs.writeFileSync(path, content, 'utf8')
}

async function waitFor(check: () => boolean, timeout: number): Promise<boolean> {
  const end = Date.now() + timeout
  while (!check()) {
    if (Date.now() > end) return false
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  return true
}

let base: string | undefined

afterEach(() => {
  if (base) fs.rmSync(base, { recursive: true, force: true })
  base = undefined
})

// The bundle inlines its locale files, so webpack does not know them as dependencies unless the
// bundle adds them, and never rebuilds it on an edit (#386)
test(
  'webpack rebuilds the messages bundle on an edit to a locale',
  { timeout: 60_000 },
  async () => {
    base = fs.realpathSync(fs.mkdtempSync(join(os.tmpdir(), 'unplugin-vue-i18n-watch-')))
    // a monorepo: the app is the webpack context, and its locales are in another package
    const root = join(base, 'apps/web')
    const locales = join(base, 'packages/core/i18n')
    const json = join(locales, 'actions/en.json')
    const output = join(base, 'dist')
    write(json, JSON.stringify({ actions: { hello: OLD } }))
    write(
      join(root, 'src/main.js'),
      `import messages from '@intlify/unplugin-vue-i18n/messages'\nexport default messages\n`
    )

    const compiler = webpack({
      mode: 'development',
      devtool: false,
      context: root,
      entry: './src/main.js',
      output: { path: output, filename: 'bundle.js' },
      plugins: [vueI18n({ include: [join(locales, '**')] }) as never]
    })
    const bundles: string[] = []
    const watching = compiler.watch({ poll: 50, aggregateTimeout: 50 }, (err, stats) => {
      if (!err && !stats?.hasErrors()) {
        bundles.push(fs.readFileSync(join(output, 'bundle.js'), 'utf8'))
      }
    })
    try {
      expect(await waitFor(() => bundles.length > 0, 30_000)).toBe(true)
      expect(bundles[0]).toContain(OLD)
      // let the watcher start before the edit
      await new Promise(resolve => setTimeout(resolve, 500))
      write(json, JSON.stringify({ actions: { hello: NEW } }))
      expect(await waitFor(() => bundles.some(code => code.includes(NEW)), 10_000)).toBe(true)
    } finally {
      await new Promise<void>(resolve => (watching ? watching.close(() => resolve()) : resolve()))
    }
  }
)
