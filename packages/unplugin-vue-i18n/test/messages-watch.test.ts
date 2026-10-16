import rspack from '@rspack/core'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import os from 'node:os'
import { basename, dirname, join } from 'node:path'
import { createServer as createServer6 } from 'rollup-vite'
import { createServer as createServer8 } from 'vite'
import webpack from 'webpack'
import { afterEach, describe, expect, test } from 'vitest'
import rspackPlugin from '../src/rspack'
import vueI18n from '../src/vite'
import webpackPlugin from '../src/webpack'
import { isTestFramework } from './utils'

type ModuleNode = { id?: string | null; url?: string; importedModules?: Set<ModuleNode> }
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
type Stats = { hasErrors: () => boolean }
type Watching = { close: (callback: () => void) => void }
type Compiler = {
  watch: (options: object, handler: (err: Error | null, stats?: Stats) => void) => Watching
}

const CREATE_SERVERS = {
  vite6: createServer6,
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

// a monorepo: the app is the root of the bundler, and its locales are in another package
function createMonorepo() {
  const base = fs.realpathSync(fs.mkdtempSync(join(os.tmpdir(), 'unplugin-vue-i18n-watch-')))
  const root = join(base, 'apps/web')
  const locales = join(base, 'packages/core/i18n')
  const json = join(locales, 'actions/en.json')
  const yaml = join(locales, 'auth/en.yaml')
  write(json, JSON.stringify({ actions: { hello: OLD } }))
  write(yaml, 'auth:\n  title: auth\n')
  write(
    join(root, 'src/main.js'),
    `import messages from '@intlify/unplugin-vue-i18n/messages'\nexport default messages\n`
  )
  return { base, root, locales, json, yaml }
}

const bases: string[] = []

afterEach(() => {
  for (const base of bases.splice(0)) fs.rmSync(base, { recursive: true, force: true })
})

describe.skipIf(!isTestFramework('vite'))('messages bundle on vite', () => {
  let server: DevServer | undefined

  afterEach(async () => {
    await server?.close()
    server = undefined
  })

  // the code of the bundle and of the locale files it imports, as the page would load them. A
  // file that a bundle only watches is in the graph too, but does not load as a module: skip it
  async function loadMessages(server: DevServer): Promise<string> {
    await server.transformRequest('/src/main.js')
    const graph = server.environments?.client?.moduleGraph ?? server.moduleGraph
    const bundle = [...(graph?.idToModuleMap.values() ?? [])].find(mod =>
      mod.id?.includes('@intlify/unplugin-vue-i18n/messages')
    )
    if (!bundle?.url) return ''
    const codes = [(await server.transformRequest(bundle.url))?.code ?? '']
    for (const mod of bundle.importedModules ?? []) {
      if (!mod.url) continue
      codes.push((await server.transformRequest(mod.url).catch(() => null))?.code ?? '')
    }
    return codes.join('\n')
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

  test('picks up an edit to a locale outside the vite root', { timeout: 30_000 }, async () => {
    const { base, root, locales, json, yaml } = createMonorepo()
    bases.push(base)
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

    // the locale files are watched, outside the root too
    const watched = (file: string) =>
      (server!.watcher.getWatched()[dirname(file)] ?? []).includes(basename(file))
    expect(await waitFor(() => watched(json) && watched(yaml), 5000)).toBe(true)

    // an edit reaches the bundle, with no `watcher.emit`
    const reloaded = waitForReload(server, 10_000)
    write(json, JSON.stringify({ actions: { hello: NEW } }))
    expect(await reloaded).toBe(true)
    expect(await loadMessages(server)).toContain(NEW)
  })
})

describe.skipIf(isTestFramework('vite'))('messages bundle on webpack and rspack', () => {
  test('rebuilds the bundle on an edit to a locale', { timeout: 60_000 }, async () => {
    const { base, root, locales, json } = createMonorepo()
    bases.push(base)
    const output = join(base, 'dist')
    const rspackLike = isTestFramework('rspack')
    const compile = (rspackLike ? rspack : webpack) as unknown as (options: object) => Compiler
    const plugin = (rspackLike ? rspackPlugin : webpackPlugin)({ include: [join(locales, '**')] })
    const compiler = compile({
      mode: 'development',
      devtool: false,
      context: root,
      entry: './src/main.js',
      output: { path: output, filename: 'bundle.js' },
      plugins: [plugin]
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
      await new Promise<void>(resolve => watching.close(() => resolve()))
    }
  })
})
