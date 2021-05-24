import { isBoolean } from '@intlify/shared'
import path from 'path'
import { build } from 'vite'
import vue from '@vitejs/plugin-vue'
import { JSDOM, VirtualConsole } from 'jsdom'
import vueI18n from '../src/index'

import type { InjectionValues } from '../src/injection'

async function bundle(fixture: string, options: Record<string, unknown> = {}) {
  const input = (options.input as string) || './fixtures/entry.ts'
  const target = (options.target as string) || './fixtures'
  const include = (options.include as string[]) || [
    path.resolve(__dirname, './fixtures/**')
  ]
  const silent = isBoolean(options.silent)
    ? options.silent === false
      ? 'info'
      : 'silent'
    : 'silent'

  const alias: Record<string, string> = {
    vue: 'vue/dist/vue.runtime.esm-browser.js'
  }
  if (!fixture.startsWith('@')) {
    alias['~target'] = path.resolve(__dirname, target, fixture)
  }

  const plugins = [vue(), vueI18n({ include })]
  if (options.intlify) {
    const intlifyVue = (await import('../src/injection')).default
    plugins.push(intlifyVue(options.intlify as InjectionValues))
  }

  const result = await build({
    logLevel: silent,
    resolve: {
      alias
    },
    plugins,
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: path.resolve(__dirname, input)
      }
    }
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { code: (result as any).output[0].code }
}

export async function bundleAndRun(
  fixture: string,
  options: Record<string, unknown> = {}
) {
  const { code } = await bundle(fixture, options)

  let dom: JSDOM | null = null
  let jsdomError
  try {
    dom = new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`, {
      runScripts: 'outside-only',
      virtualConsole: new VirtualConsole()
    })
    dom.window.eval(code)
  } catch (e) {
    console.error(`JSDOM error:\n${e.stack}`)
    jsdomError = e
  }

  if (!dom) {
    return Promise.reject(new Error('Cannot assigned JSDOM instance'))
  }

  const { window } = dom
  const { module, exports } = window

  return Promise.resolve({
    window,
    module,
    exports,
    jsdomError
  })
}
