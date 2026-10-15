import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import os from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import vueI18n from '../src/vite'
import { isTestFramework } from './utils'

type BuildOutput = { output: { code?: string }[] }
type DevServer = {
  transformRequest: (url: string) => Promise<{ code: string } | null>
  close: () => Promise<void>
}

const MESSAGE = 'hello from the root'

async function loadVite() {
  return process.env.TEST_VITE_TYPE === 'vite6' ? await import('rollup-vite') : await import('vite')
}

function createProject() {
  const root = fs.realpathSync(fs.mkdtempSync(join(os.tmpdir(), 'unplugin-vue-i18n-root-')))
  fs.mkdirSync(join(root, 'src/locales'), { recursive: true })
  fs.writeFileSync(join(root, 'src/locales/en.json'), `${JSON.stringify({ hello: MESSAGE })}\n`)
  // a path from the root of the project, not from the file system root
  fs.writeFileSync(
    join(root, 'src/entry.js'),
    `import en from '/src/locales/en.json'\nexport default en\n`
  )
  return root
}

function plugins(root: string) {
  return [vue(), vueI18n({ include: [resolve(root, 'src/locales/**')] })] as never
}

describe.skipIf(!isTestFramework('vite'))('root-relative import of a JSON locale', () => {
  const roots: string[] = []

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('builds', async () => {
    const root = createProject()
    roots.push(root)
    const { build } = await loadVite()
    const result = (await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: plugins(root),
      build: {
        write: false,
        minify: false,
        lib: { entry: resolve(root, 'src/entry.js'), formats: ['es'], fileName: 'entry' }
      }
    })) as unknown as BuildOutput | BuildOutput[]
    const { output } = Array.isArray(result) ? result[0] : result
    expect(output[0].code).toContain(MESSAGE)
  })

  test('is served by the dev server', async () => {
    const root = createProject()
    roots.push(root)
    const { createServer } = await loadVite()
    const server = (await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      server: { port: 0, strictPort: false },
      plugins: plugins(root)
    })) as unknown as DevServer
    try {
      const result = await server.transformRequest('/src/locales/en.json')
      expect(result?.code).toContain(MESSAGE)
      expect(result?.code).toContain('export default')
    } finally {
      await server.close()
    }
  })
})
