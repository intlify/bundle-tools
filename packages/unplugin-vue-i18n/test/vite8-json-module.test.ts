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
  const root = fs.realpathSync(fs.mkdtempSync(join(os.tmpdir(), 'unplugin-vue-i18n-optf-')))
  fs.mkdirSync(join(root, 'src/locales'), { recursive: true })
  fs.writeFileSync(join(root, 'src/locales/en.json'), `${JSON.stringify({ greeting: 'hello' })}\n`)
  fs.writeFileSync(
    join(root, 'src/en.js'),
    `import en from './locales/en.json'\nexport default en\n`
  )
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

// On Vite 8 the plugin no longer rewrites JSON locales to virtual ids: `transform` compiles them
// and returns `moduleType: 'js'`, so they stay normal modules keyed on their real path.
describe.skipIf(!isTestFramework('vite') || process.env.TEST_VITE_TYPE === 'vite6')(
  'vite 8 JSON locales are normal modules (no virtual ids)',
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

    test('a locale import keeps its real id, not an intlify-i18n virtual id', async () => {
      const root = createProject()
      roots.push(root)
      const server = await createServer(root)
      servers.push(server)
      const importer = await server.transformRequest('/src/en.js')
      expect(importer?.code).toBeDefined()
      expect(importer!.code).not.toMatch(/intlify-i18n-/)
      const loaded = await server.transformRequest('/src/locales/en.json')
      expect(loaded?.code).toContain('hello')
    })
  }
)
