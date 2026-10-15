import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import os from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import vueI18n from '../../src/vite'

type DevServer = {
  transformRequest: (url: string) => Promise<{ code: string } | null>
  close: () => Promise<void>
}

async function loadVite() {
  return process.env.TEST_VITE_TYPE === 'vite6' ? await import('rollup-vite') : await import('vite')
}

function createProject() {
  const root = fs.realpathSync(fs.mkdtempSync(join(os.tmpdir(), 'unplugin-vue-i18n-627-')))
  fs.mkdirSync(join(root, 'src/locales'), { recursive: true })
  fs.writeFileSync(join(root, 'src/locales/en.json'), `${JSON.stringify({ greeting: 'hello' })}\n`)
  fs.writeFileSync(
    join(root, 'src/locales/ja.json'),
    `${JSON.stringify({ greeting: 'konnichiwa' })}\n`
  )
  fs.writeFileSync(
    join(root, 'src/en.js'),
    `import en from './locales/en.json'\nexport default en\n`
  )
  fs.writeFileSync(
    join(root, 'src/ja.js'),
    `import ja from './locales/ja.json'\nexport default ja\n`
  )
  return root
}

function plugins(root: string) {
  return [vue(), vueI18n({ include: [resolve(root, 'src/locales/**')] })] as never
}

// a new dev server has a new plugin instance, as in another process
async function createServer(root: string) {
  const { createServer } = await loadVite()
  return (await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    server: { port: 0, strictPort: false },
    plugins: plugins(root)
  })) as unknown as DevServer
}

// the id of the locale module that the transformed importer imports
async function importedLocaleId(server: DevServer, importer: string) {
  const result = await server.transformRequest(importer)
  const url = result?.code.match(/["'](\/@id\/[^"']*intlify-i18n-[^"']*)["']/)?.[1]
  expect(url).toBeDefined()
  // the dev server unwraps an `/@id/` url to the id, as its middleware does
  return url!.replace(/^\/@id\/__x00__/, '\0').replace(/^\/@id\//, '')
}

// on Vite 8, JSON resources are served as virtual modules (on Vite 6, they keep their real ids)
describe.skipIf(process.env.TEST_VITE_TYPE === 'vite6')('virtual ids of locale resources', () => {
  const roots: string[] = []
  const servers: DevServer[] = []

  afterEach(async () => {
    for (const server of servers.splice(0)) {
      await server.close()
    }
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('gives a resource the same id in every process', async () => {
    const root = createProject()
    roots.push(root)
    const first = await createServer(root)
    const second = await createServer(root)
    servers.push(first, second)
    // the second process resolves another resource first
    await importedLocaleId(second, '/src/ja.js')
    expect(await importedLocaleId(second, '/src/en.js')).toBe(
      await importedLocaleId(first, '/src/en.js')
    )
  })

  // a persistent transform cache keeps the importer, with the id written in its code
  test('loads an id that another process gave', async () => {
    const root = createProject()
    roots.push(root)
    const first = await createServer(root)
    servers.push(first)
    const id = await importedLocaleId(first, '/src/en.js')
    const second = await createServer(root)
    servers.push(second)
    const result = await second.transformRequest(id)
    expect(result?.code).toContain('hello')
  })

  test('loads the right resource when another one was resolved first', async () => {
    const root = createProject()
    roots.push(root)
    const first = await createServer(root)
    servers.push(first)
    const id = await importedLocaleId(first, '/src/en.js')
    const second = await createServer(root)
    servers.push(second)
    await importedLocaleId(second, '/src/ja.js')
    const result = await second.transformRequest(id)
    expect(result?.code).toContain('hello')
    expect(result?.code).not.toContain('konnichiwa')
  })

  // the bundler names a chunk after the end of the id: with the key there, a long path would
  // make a file name that is too long to write
  test('names the chunk of a lazily loaded resource after the file', async () => {
    const root = createProject()
    roots.push(root)
    fs.writeFileSync(
      join(root, 'src/lazy.js'),
      `globalThis.load = () => import('./locales/en.json')\n`
    )
    const { build } = await loadVite()
    const result = (await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: plugins(root),
      build: { write: false, rollupOptions: { input: join(root, 'src/lazy.js') } }
    })) as unknown as { output: { fileName: string }[] }
    expect(result.output.map(output => output.fileName)).toContainEqual(
      expect.stringMatching(/^assets\/en-[\w-]+\.js$/)
    )
  })
})
