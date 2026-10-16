import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import os from 'node:os'
import { basename, dirname, join } from 'node:path'
import { createServer as createServer6 } from 'rollup-vite'
import { createServer as createServer8 } from 'vite'
import { createServer as createServer7 } from 'vite7'
import { afterEach, expect, test } from 'vitest'
import vueI18n from '../../src/vite'

type ModuleNode = { id?: string | null; url?: string }
type ModuleGraph = { idToModuleMap: Map<string, ModuleNode> }
type HotChannel = { send: (...args: unknown[]) => unknown }
type DevServer = {
  listen: () => Promise<unknown>
  close: () => Promise<void>
  transformRequest: (url: string) => Promise<{ code: string } | null>
  watcher: { getWatched: () => Record<string, string[]> }
  ws?: HotChannel
  moduleGraph?: ModuleGraph
  environments?: { client?: { hot?: HotChannel; moduleGraph?: ModuleGraph } }
}

const CREATE_SERVERS = {
  vite6: createServer6,
  vite7: createServer7,
  vite8: createServer8
} as unknown as Record<string, (config: object) => Promise<DevServer>>

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

// the code of the `messages` bundle (it inlines the locale files), as the page would load it
async function loadMessages(server: DevServer): Promise<string> {
  await server.transformRequest('/src/main.ts')
  const graph = server.environments?.client?.moduleGraph ?? server.moduleGraph
  const bundle = [...(graph?.idToModuleMap.values() ?? [])].find(mod =>
    mod.id?.includes('@intlify/unplugin-vue-i18n/messages')
  )
  return bundle?.url ? ((await server.transformRequest(bundle.url))?.code ?? '') : ''
}

// whether the server tells the page to update or reload within `timeout`
function waitForReload(server: DevServer, timeout: number): Promise<boolean> {
  const channel = (server.environments?.client?.hot ?? server.ws)!
  const send = channel.send
  return new Promise(resolve => {
    const done = (reloaded: boolean) => {
      clearTimeout(timer)
      channel.send = send
      resolve(reloaded)
    }
    const timer = setTimeout(() => done(false), timeout)
    channel.send = (...args: unknown[]) => {
      const type = (args[0] as { type?: string } | undefined)?.type
      if (type === 'full-reload' || type === 'update') done(true)
      return send.apply(channel, args)
    }
  })
}

let base: string | undefined
let server: DevServer | undefined

afterEach(async () => {
  await server?.close()
  if (base) fs.rmSync(base, { recursive: true, force: true })
  server = undefined
  base = undefined
})

// The bundle inlines its locale files, so they are not modules, and vite watches them only under
// its root unless the bundle asks for them (#386)
test(
  'messages bundle picks up an edit to a locale outside the vite root',
  { timeout: 30_000 },
  async () => {
    base = fs.realpathSync(fs.mkdtempSync(join(os.tmpdir(), 'unplugin-vue-i18n-watch-')))
    // a monorepo: the app is the vite root, and its locales are in another package
    const root = join(base, 'apps/web')
    const locales = join(base, 'packages/core/i18n')
    const json = join(locales, 'actions/en.json')
    const yaml = join(locales, 'auth/en.yaml')
    write(json, JSON.stringify({ actions: { hello: OLD } }))
    write(yaml, 'auth:\n  title: auth\n')
    write(
      join(root, 'src/main.ts'),
      `import messages from '@intlify/unplugin-vue-i18n/messages'\nexport default messages\n`
    )

    const createServer = CREATE_SERVERS[process.env.TEST_VITE_TYPE || 'vite8']
    server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      server: { port: 0, strictPort: false, watch: { usePolling: true, interval: 50 } },
      plugins: [vue(), vueI18n({ include: [join(locales, '**')] })]
    })
    await server.listen()
    expect(await loadMessages(server)).toContain(OLD)

    // the bundle watches the files it reads
    const watched = (file: string) =>
      (server!.watcher.getWatched()[dirname(file)] ?? []).includes(basename(file))
    expect(await waitFor(() => watched(json) && watched(yaml), 5000)).toBe(true)

    // an edit reaches the bundle, with no `watcher.emit`
    const reloaded = waitForReload(server, 10_000)
    write(json, JSON.stringify({ actions: { hello: NEW } }))
    expect(await reloaded).toBe(true)
    expect(await loadMessages(server)).toContain(NEW)
  }
)
