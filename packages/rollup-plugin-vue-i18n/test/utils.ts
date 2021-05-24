import path from 'path'
import { rollup } from 'rollup'
import alias from '@rollup/plugin-alias'
import VuePlugin from 'rollup-plugin-vue'
import I18nPlugin from '../src/index'
import { JSDOM, VirtualConsole } from 'jsdom'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function bundle(fixture: string, options: Record<string, unknown> = {}) {
  const input = (options.input as string) || './fixtures/entry.js'
  const target = (options.target as string) || './fixtures'
  return rollup({
    input: path.resolve(__dirname, input),
    plugins: [
      alias({
        entries: {
          '~target': path.resolve(__dirname, target, fixture)
        }
      }),
      I18nPlugin(options),
      VuePlugin({
        customBlocks: ['i18n']
      })
    ],
    onwarn: () => {
      return
    }
  })
    .then(bundle => bundle.generate({ format: 'esm' }))
    .then(generated => generated.output[0])
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
