import rspack from '@rspack/core'
import vue from '@vitejs/plugin-vue'
import memoryfs from 'memory-fs'
import fs from 'node:fs'
import os from 'node:os'
import { join, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import webpack from 'webpack'
import { afterEach, describe, expect, test } from 'vitest'
import rspackPlugin from '../src/rspack'
import vueI18n from '../src/vite'
import webpackPlugin from '../src/webpack'
import { isTestFramework } from './utils'

type BuildOutput = { output: { code?: string }[] }
type DevServer = {
  transformRequest: (url: string) => Promise<{ code: string } | null>
  close: () => Promise<void>
}
type Stats = { hasErrors: () => boolean; toJson: () => { errors?: { message: string }[] } }
type Compiler = {
  outputFileSystem: unknown
  run: (callback: (err: Error | null, stats?: Stats) => void) => void
}

const MESSAGE = 'hello from the block'
// a JSON file that is not a locale resource
const DATA = { name: 'my-app', version: '1.0.0' }

async function loadVite() {
  return process.env.TEST_VITE_TYPE === 'vite6' ? await import('rollup-vite') : await import('vite')
}

// an app that has only an i18n custom block, and a JSON file that is not a locale
function createProject() {
  const root = fs.realpathSync(fs.mkdtempSync(join(os.tmpdir(), 'unplugin-vue-i18n-no-include-')))
  fs.mkdirSync(join(root, 'src'), { recursive: true })
  fs.writeFileSync(
    join(root, 'src/App.vue'),
    `<template><p>app</p></template>\n<i18n lang="json">\n${JSON.stringify({ en: { hello: MESSAGE } })}\n</i18n>\n`
  )
  fs.writeFileSync(join(root, 'src/main.js'), `import App from './App.vue'\nexport default App\n`)
  fs.writeFileSync(join(root, 'src/data.json'), `${JSON.stringify(DATA)}\n`)
  fs.writeFileSync(
    join(root, 'src/data.js'),
    `import data from './data.json'\nexport default data\n`
  )
  return root
}

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe.skipIf(!isTestFramework('vite'))('without include on vite', () => {
  async function buildLib(root: string, entry: string) {
    const { build } = await loadVite()
    const result = (await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [vue(), vueI18n()] as never,
      build: {
        write: false,
        minify: false,
        lib: { entry: resolve(root, entry), formats: ['es'], fileName: 'entry' },
        rollupOptions: { external: ['vue'] }
      }
    })) as unknown as BuildOutput | BuildOutput[]
    const { output } = Array.isArray(result) ? result[0] : result
    return output[0].code!
  }

  test('builds an app that has only i18n custom blocks', async () => {
    const root = createProject()
    roots.push(root)
    expect(await buildLib(root, 'src/main.js')).toContain(MESSAGE)
  })

  test('does not compile a JSON file that is not a locale', async () => {
    const root = createProject()
    roots.push(root)
    const code = await buildLib(root, 'src/data.js')
    const mod = await import(`data:text/javascript,${encodeURIComponent(code)}`)
    expect(mod.default).toEqual(DATA)
  })

  test('serves the app on the dev server', async () => {
    const root = createProject()
    roots.push(root)
    const { createServer } = await loadVite()
    const server = (await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      server: { port: 0, strictPort: false },
      plugins: [vue(), vueI18n()] as never
    })) as unknown as DevServer
    try {
      const result = await server.transformRequest('/src/main.js')
      expect(result?.code).toContain('/src/App.vue')
    } finally {
      await server.close()
    }
  })
})

describe.skipIf(isTestFramework('vite'))('without include on webpack and rspack', () => {
  test('does not parse a JSON file that is not a locale as JavaScript', async () => {
    const root = createProject()
    roots.push(root)
    const rspackLike = isTestFramework('rspack')
    const compile = (rspackLike ? rspack : webpack) as unknown as (options: object) => Compiler
    const compiler = compile({
      mode: 'development',
      devtool: false,
      context: root,
      entry: resolve(root, 'src/data.js'),
      output: { path: '/', filename: 'bundle.js', library: { type: 'commonjs2' } },
      plugins: [rspackLike ? rspackPlugin() : webpackPlugin()]
    })
    const mfs = new memoryfs()
    compiler.outputFileSystem = mfs
    await new Promise<void>((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err) return reject(err)
        if (stats?.hasErrors()) {
          const errors = stats.toJson().errors || []
          return reject(new Error(errors.map(e => e.message).join(' | ')))
        }
        resolve()
      })
    })
    const sandbox = { module: { exports: {} as { default?: unknown } } }
    runInNewContext(mfs.readFileSync('/bundle.js').toString(), sandbox)
    expect(sandbox.module.exports.default).toEqual(DATA)
  })
})
