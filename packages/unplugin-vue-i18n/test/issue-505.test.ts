import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import os from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import vueI18n from '../src/vite'
import { isTestFramework } from './utils'

type DevServer = {
  transformRequest: (url: string) => Promise<{ code: string } | null>
  close: () => Promise<void>
}

function createProject() {
  const root = fs.realpathSync(fs.mkdtempSync(join(os.tmpdir(), 'unplugin-vue-i18n-505-')))
  fs.mkdirSync(join(root, 'src/locales'), { recursive: true })
  fs.writeFileSync(join(root, 'src/locales/en.yaml'), 'hello: hello world')
  fs.writeFileSync(join(root, 'src/locales/en.json'), JSON.stringify({ hello: 'hello world' }))
  return root
}

async function createServer(root: string) {
  const { createServer } = await import('vite')
  return (await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    server: { port: 0, strictPort: false },
    plugins: [vue(), vueI18n({ include: [resolve(root, 'src/locales/**')] })] as never
  })) as unknown as DevServer
}

// A locale under `include` that is imported with `?raw` or `?url` must not be compiled by the
// plugin: it should keep Vite's raw string / url, as the Vite docs describe. This already works on
// v12 (the compile gate checks the id's own extension); the test guards against a regression and
// mirrors the v11 fix for #505.
const COMPILED = /const resource|__i18n|messageFn|\bfunction\b|createMessage/

describe.skipIf(!isTestFramework('vite'))(
  'issue #505: ?raw / ?url imports of locale resources',
  () => {
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

    async function serve() {
      const root = createProject()
      roots.push(root)
      const server = await createServer(root)
      servers.push(server)
      return server
    }

    test('?raw keeps the raw yaml text, not a compiled resource', async () => {
      const server = await serve()
      const loaded = await server.transformRequest('/src/locales/en.yaml?raw')
      expect(loaded?.code).toBeDefined()
      expect(loaded!.code).toContain('hello: hello world')
      expect(loaded!.code).not.toMatch(COMPILED)
    })

    test('?raw keeps the raw json text, not a compiled resource', async () => {
      const server = await serve()
      const loaded = await server.transformRequest('/src/locales/en.json?raw')
      expect(loaded?.code).toBeDefined()
      expect(loaded!.code).toContain('hello world')
      expect(loaded!.code).not.toMatch(COMPILED)
    })

    test('?url returns the asset url, not a compiled resource', async () => {
      const server = await serve()
      const loaded = await server.transformRequest('/src/locales/en.yaml?url')
      expect(loaded?.code).toBeDefined()
      expect(loaded!.code).toContain('/src/locales/en.yaml')
      expect(loaded!.code).not.toMatch(COMPILED)
    })

    test('a normal import is still compiled', async () => {
      const server = await serve()
      const loaded = await server.transformRequest('/src/locales/en.yaml')
      expect(loaded?.code).toBeDefined()
      expect(loaded!.code).toMatch(COMPILED)
    })
  }
)
