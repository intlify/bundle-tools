import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import os from 'node:os'
import { dirname, join } from 'node:path'
import { createServer as createServer6 } from 'rollup-vite'
import { createServer as createServer8 } from 'vite'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import vueI18n from '../src/vite'
import { isTestFramework } from './utils'

type ModuleNode = { url?: string }
type ModuleGraph = { idToModuleMap: Map<string, ModuleNode> }
type HotChannel = { send: (...args: unknown[]) => unknown }
type HmrPayload = { type?: string; updates?: { path: string }[] }
type DevServer = {
  listen: () => Promise<unknown>
  close: () => Promise<void>
  transformRequest: (url: string) => Promise<{ code: string } | null>
  watcher: { emit: (event: string, path: string) => void }
  ws?: HotChannel
  moduleGraph?: ModuleGraph
  environments?: { client?: { hot?: HotChannel; moduleGraph?: ModuleGraph } }
}

const CREATE_SERVERS = {
  vite6: createServer6,
  vite8: createServer8
} as unknown as Record<string, (config: object) => Promise<DevServer>>

function write(path: string, content: string) {
  fs.mkdirSync(dirname(path), { recursive: true })
  fs.writeFileSync(path, content, 'utf8')
}

// The page imports the `messages` bundle. A change to a file outside `include` must not reload the
// page through it, as on v11 up to v11.2.4: a change to any JSON / YAML / JS / TS file did, and a
// self-accepting module lost its HMR (#112)
describe.skipIf(!isTestFramework('vite'))(
  'HMR of files outside include, with the messages bundle imported',
  () => {
    let root: string
    let server: DevServer

    beforeAll(async () => {
      root = fs.realpathSync(fs.mkdtempSync(join(os.tmpdir(), 'unplugin-vue-i18n-hmr-')))
      write(join(root, 'src/locales/en.json'), JSON.stringify({ hello: 'hello' }))
      write(
        join(root, 'src/counter.ts'),
        'export const count = 1\nif (import.meta.hot) import.meta.hot.accept()\n'
      )
      // files that tools like unplugin-auto-import write, which the page does not import
      write(join(root, 'src/auto-imports.d.ts'), 'export {}\n')
      write(join(root, '.eslintrc-auto-import.json'), JSON.stringify({ globals: {} }))
      write(
        join(root, 'src/main.ts'),
        [
          "import messages from '@intlify/unplugin-vue-i18n/messages'",
          "import { count } from './counter'",
          'console.log(messages, count)',
          ''
        ].join('\n')
      )

      const createServer = CREATE_SERVERS[process.env.TEST_VITE_TYPE || 'vite8']
      server = await createServer({
        root,
        configFile: false,
        logLevel: 'silent',
        server: { port: 0, strictPort: false },
        plugins: [vue(), vueI18n({ include: [join(root, 'src/locales/**')] })]
      })
      await server.listen()
      // load the page: the entry, the bundle and the counter
      await server.transformRequest('/src/main.ts')
      const graph = server.environments?.client?.moduleGraph ?? server.moduleGraph
      for (const mod of [...(graph?.idToModuleMap.values() ?? [])]) {
        if (mod.url) await server.transformRequest(mod.url).catch(() => null)
      }
    })

    afterAll(async () => {
      await server?.close()
      if (root) fs.rmSync(root, { recursive: true, force: true })
    })

    // the HMR payloads that the server sends for a change to `file`
    async function hmrFor(file: string): Promise<string[]> {
      const channel = (server.environments?.client?.hot ?? server.ws)!
      const send = channel.send
      const payloads: string[] = []
      channel.send = (...args: unknown[]) => {
        const payload = args[0] as HmrPayload | undefined
        if (payload?.type === 'full-reload') payloads.push('full-reload')
        if (payload?.type === 'update') {
          payloads.push(...(payload.updates ?? []).map(update => `update ${update.path}`))
        }
        return send.apply(channel, args)
      }
      try {
        server.watcher.emit('change', join(root, file))
        await new Promise(resolve => setTimeout(resolve, 1000))
      } finally {
        channel.send = send
      }
      return payloads
    }

    test('sends nothing for files outside include that the page does not import', async () => {
      expect(await hmrFor('.eslintrc-auto-import.json')).toEqual([])
      expect(await hmrFor('src/auto-imports.d.ts')).toEqual([])
    })

    test('hot-updates a self-accepting module', async () => {
      expect(await hmrFor('src/counter.ts')).toEqual(['update /src/counter.ts'])
    })

    test('reloads the page for a locale in include', async () => {
      expect(await hmrFor('src/locales/en.json')).toContain('full-reload')
    })
  }
)
