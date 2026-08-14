import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import os from 'node:os'
import { join, resolve } from 'node:path'
import { normalize } from 'pathe'
import { afterEach, describe, expect, test } from 'vitest'
import vueI18n from '../../src/vite'

type GraphModule = {
  id?: string | null
  url?: string
  file?: string | null
  importedModules?: Set<GraphModule>
  transformResult?: { code?: string } | null
}

type ViteServer = {
  listen: () => Promise<unknown>
  close: () => Promise<void>
  transformRequest: (url: string) => Promise<{ code: string } | null>
  watcher: { emit: (event: string, path: string) => void }
  ws?: { send: (...args: unknown[]) => unknown }
  environments?: {
    client?: {
      hot?: { send: (...args: unknown[]) => unknown }
      transformRequest?: (url: string) => Promise<{ code: string } | null>
      moduleGraph?: {
        idToModuleMap: Map<string, GraphModule>
        getModulesByFile?: (file: string) => Set<GraphModule> | undefined
      }
    }
  }
  moduleGraph?: {
    idToModuleMap: Map<string, GraphModule>
    urlToModuleMap?: Map<string, GraphModule>
    getModulesByFile?: (file: string) => Set<GraphModule> | undefined
  }
}

type HmrPayload = { type?: string }
type LocaleKind = 'yml' | 'json'
type CaseKind = 'yml' | 'json' | 'bundle' | 'app'

const OLD_TOKEN = 'hello-old'
const NEW_TOKEN = 'hello-new'

function getViteType(): 'vite6' | 'vite8' {
  return process.env.TEST_VITE_TYPE === 'vite6' ? 'vite6' : 'vite8'
}

function writeFile(path: string, content: string) {
  fs.mkdirSync(join(path, '..'), { recursive: true })
  fs.writeFileSync(path, content, 'utf8')
}

function writeLocale(path: string, token: string, kind: LocaleKind) {
  if (kind === 'yml') {
    writeFile(path, `hello: ${token}\n`)
  } else {
    writeFile(path, `${JSON.stringify({ hello: token }, null, 2)}\n`)
  }
  const now = new Date()
  fs.utimesSync(path, now, now)
}

function createFixture(kind: CaseKind) {
  const root = fs.realpathSync(fs.mkdtempSync(join(os.tmpdir(), 'unplugin-vue-i18n-hmr-')))
  const globPattern = kind === 'json' ? './locales/*.json' : './locales/*.yml'
  writeFile(
    join(root, 'index.html'),
    '<!doctype html><html><body><script type="module" src="/src/entry.ts"></script></body></html>\n'
  )
  writeFile(
    join(root, 'src/entry.ts'),
    `const locales = import.meta.glob('${globPattern}', { eager: true, import: 'default' })
export default locales
`
  )
  writeFile(
    join(root, 'src/entry-bundle.ts'),
    `import messages from '@intlify/unplugin-vue-i18n/messages'
export default messages
`
  )
  writeFile(join(root, 'src/app.ts'), `export const label = '${OLD_TOKEN}'\n`)
  if (kind === 'json') {
    writeLocale(join(root, 'src/locales/en.json'), OLD_TOKEN, 'json')
  } else if (kind !== 'app') {
    writeLocale(join(root, 'src/locales/en.yml'), OLD_TOKEN, 'yml')
  }
  return root
}

function wrapHmrSend(server: ViteServer, onPayload: (payload: HmrPayload) => void): () => void {
  const target = server.environments?.client?.hot ?? server.ws
  if (target == null || typeof target.send !== 'function') {
    throw new Error('Vite HMR send is not available to wrap')
  }
  const original = target.send.bind(target)
  target.send = (...args: unknown[]) => {
    const payload = typeof args[0] === 'string' ? { type: 'custom' } : (args[0] as HmrPayload)
    if (payload && typeof payload === 'object') {
      onPayload(payload)
    }
    return original(...args)
  }
  return () => {
    target.send = original
  }
}

function waitForHmrSignal(
  server: ViteServer,
  timeoutMs = 5000
): Promise<{ type: 'update' | 'full-reload' }> {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {}
    const timer = setTimeout(() => {
      unsubscribe()
      reject(new Error('timed out waiting for Vite HMR update or full-reload'))
    }, timeoutMs)

    unsubscribe = wrapHmrSend(server, payload => {
      if (payload.type === 'update' || payload.type === 'full-reload') {
        clearTimeout(timer)
        unsubscribe()
        resolve({ type: payload.type })
      }
    })
  })
}

async function loadViteCreateServer() {
  if (getViteType() === 'vite6') {
    return (await import('rollup-vite')).createServer
  }
  return (await import('vite')).createServer
}

async function startServer(root: string): Promise<ViteServer> {
  const createServer = await loadViteCreateServer()
  const server = (await createServer({
    root,
    logLevel: 'silent',
    configFile: false,
    server: {
      port: 0,
      strictPort: false,
      watch: { usePolling: true, interval: 50 },
      fs: { strict: false, allow: [root] }
    },
    plugins: [
      vue(),
      vueI18n({
        include: [resolve(root, 'src/locales/**')]
      })
    ] as never
  })) as unknown as ViteServer
  await server.listen()
  return server
}

function collectModules(server: ViteServer): GraphModule[] {
  const maps = [
    server.moduleGraph?.idToModuleMap,
    server.environments?.client?.moduleGraph?.idToModuleMap
  ]
  const mods: GraphModule[] = []
  for (const map of maps) {
    if (map) {
      mods.push(...map.values())
    }
  }
  return mods
}

async function tryTransform(server: ViteServer, url: string): Promise<string | null> {
  try {
    const result = await server.transformRequest(url)
    if (result?.code) return result.code
  } catch {
    // try environment pipeline
  }
  try {
    const result = await server.environments?.client?.transformRequest?.(url)
    if (result?.code) return result.code
  } catch {
    return null
  }
  return null
}

async function transformTarget(
  server: ViteServer,
  absFile: string,
  fallbackUrl: string
): Promise<{ url: string; code: string }> {
  const candidates = new Set<string>([fallbackUrl, absFile])

  for (const mod of collectModules(server)) {
    if (mod.file && normalize(mod.file) === normalize(absFile)) {
      if (mod.url) candidates.add(mod.url)
      if (mod.id) candidates.add(mod.id)
    }
    if (mod.id?.includes('intlify-i18n') || mod.url?.includes('intlify-i18n')) {
      if (mod.url) candidates.add(mod.url)
      if (mod.id) candidates.add(mod.id)
    }
    if (
      mod.transformResult?.code?.includes(OLD_TOKEN) ||
      mod.transformResult?.code?.includes(NEW_TOKEN)
    ) {
      if (mod.url) candidates.add(mod.url)
      if (mod.id) candidates.add(mod.id)
    }
  }

  const errors: string[] = []
  for (const url of candidates) {
    const code = await tryTransform(server, url)
    if (code) {
      return { url, code }
    }
    errors.push(url)
  }

  throw new Error(`transformRequest returned no code for ${absFile} (tried ${errors.join(', ')})`)
}

describe('locale resource HMR', () => {
  const roots: string[] = []
  const servers: ViteServer[] = []

  afterEach(async () => {
    for (const server of servers.splice(0)) {
      await server.close()
    }
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('normalized locale paths match Windows and posix separators', () => {
    expect(normalize('C:\\proj\\en.yml')).toBe(normalize('C:/proj/en.yml'))
  })

  async function boot(kind: CaseKind) {
    const root = createFixture(kind)
    roots.push(root)
    const server = await startServer(root)
    servers.push(server)
    return { root, server, bootServer: server }
  }

  async function changeAndAssert(opts: {
    server: ViteServer
    bootServer: ViteServer
    file: string
    url: string
    entry: string
    kind: LocaleKind | 'ts'
  }) {
    const { server, bootServer, file, url, entry } = opts
    await tryTransform(server, entry)
    const before = await transformTarget(server, file, url)
    expect(before.code).toContain(OLD_TOKEN)

    const pending = waitForHmrSignal(server)
    if (opts.kind === 'ts') {
      writeFile(file, `export const label = '${NEW_TOKEN}'\n`)
      fs.utimesSync(file, new Date(), new Date())
    } else {
      writeLocale(file, NEW_TOKEN, opts.kind)
    }
    server.watcher.emit('change', normalize(file))

    const signal = await pending
    expect(signal.type === 'update' || signal.type === 'full-reload').toBe(true)

    const after = await transformTarget(server, file, before.url)
    expect(after.code).toContain(NEW_TOKEN)
    expect(after.code).not.toContain(OLD_TOKEN)
    expect(after.code).not.toBe(before.code)
    expect(server).toBe(bootServer)
    return signal.type
  }

  test('glob yaml locale updates without restarting the server', async () => {
    const { root, server, bootServer } = await boot('yml')
    const type = await changeAndAssert({
      server,
      bootServer,
      file: join(root, 'src/locales/en.yml'),
      url: '/src/locales/en.yml',
      entry: '/src/entry.ts',
      kind: 'yml'
    })
    expect(type === 'update' || type === 'full-reload').toBe(true)
  })

  test('glob json locale updates without restarting the server', async () => {
    const { root, server, bootServer } = await boot('json')
    const type = await changeAndAssert({
      server,
      bootServer,
      file: join(root, 'src/locales/en.json'),
      url: '/src/locales/en.json',
      entry: '/src/entry.ts',
      kind: 'json'
    })
    expect(type === 'update' || type === 'full-reload').toBe(true)
  })

  test('bundle import yaml locale updates without restarting the server', async () => {
    const { root, server, bootServer } = await boot('bundle')
    const type = await changeAndAssert({
      server,
      bootServer,
      file: join(root, 'src/locales/en.yml'),
      url: '/src/locales/en.yml',
      entry: '/src/entry-bundle.ts',
      kind: 'yml'
    })
    expect(type === 'update' || type === 'full-reload').toBe(true)
  })

  test('app module still hot-updates', async () => {
    const { root, server, bootServer } = await boot('app')
    const type = await changeAndAssert({
      server,
      bootServer,
      file: join(root, 'src/app.ts'),
      url: '/src/app.ts',
      entry: '/src/app.ts',
      kind: 'ts'
    })
    expect(type === 'update' || type === 'full-reload').toBe(true)
  })
})
