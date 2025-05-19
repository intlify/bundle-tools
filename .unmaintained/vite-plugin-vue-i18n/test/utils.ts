import { isBoolean, isString } from '@intlify/shared'
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
  const sourcemap = (options.sourcemap as boolean) || false
  const silent = isBoolean(options.silent)
    ? options.silent === false
      ? 'info'
      : 'silent'
    : 'silent'
  const defaultSFCLang = isString(options.defaultSFCLang)
    ? options.defaultSFCLang
    : undefined
  const globalSFCScope = isBoolean(options.globalSFCScope)
    ? options.globalSFCScope
    : undefined

  const alias: Record<string, string> = {
    vue: 'vue/dist/vue.runtime.esm-browser.js'
  }
  if (!fixture.startsWith('@')) {
    alias['~target'] = path.resolve(__dirname, target, fixture)
  }

  // @ts-ignore
  const plugins = [vue(), vueI18n({ include, defaultSFCLang, globalSFCScope })]
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
      sourcemap,
      write: false,
      minify: false,
      rollupOptions: {
        input: path.resolve(__dirname, input)
      }
    }
  })
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    code: (result as any).output[0].code,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map: (result as any).output[0].map
  }
}

export async function bundleAndRun(
  fixture: string,
  options: Record<string, unknown> = {}
) {
  const { code, map } = await bundle(fixture, options)

  let dom: JSDOM | null = null
  let jsdomError
  try {
    dom = new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`, {
      runScripts: 'outside-only',
      virtualConsole: new VirtualConsole()
    })
    dom.window.eval(code)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
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
    code,
    map,
    jsdomError
  })
}
