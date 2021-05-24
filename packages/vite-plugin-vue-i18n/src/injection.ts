import { debug as Debug } from 'debug'
import MagicString from 'magic-string'
import { isObject, isFunction, isRegExp, isString } from '@intlify/shared'

import type { Plugin, ResolvedConfig } from 'vite'

const debug = Debug('vite-plugin-vue-i18n:intlify-vue')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InjectionValues = Record<string, any>

console.warn(
  `[@intlify/vite-i18n-vue-i18n] IntlifyVue plugin is experimental! This plugin is used for Intlify Devtools. Don't use this plugin to enhancement Component options of your application.`
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stringifyObj(obj: Record<string, any>): string {
  return `Object({${Object.keys(obj)
    .map(key => {
      const code = obj[key]
      return `${JSON.stringify(key)}:${toCode(code)}`
    })
    .join(',')}})`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCode(code: any): string {
  if (code === null) {
    return 'null'
  }

  if (code === undefined) {
    return 'undefined'
  }

  if (isString(code)) {
    return JSON.stringify(code)
  }

  if (isRegExp(code) && code.toString) {
    return code.toString()
  }

  if (isFunction(code) && code.toString) {
    return '(' + code.toString() + ')'
  }

  if (isObject(code)) {
    return stringifyObj(code)
  }

  return code + ''
}

function generateCode(
  values: InjectionValues,
  indentifier: string,
  id: string,
  config: ResolvedConfig
): string {
  const injectionCodes = ['']
  Object.keys(values).forEach(key => {
    const code = values[key]
    if (isFunction(code)) {
      injectionCodes.push(
        `${indentifier}.${key} = ${JSON.stringify(code(id, config))}`
      )
    } else {
      injectionCodes.push(`${indentifier}.${key} = ${toCode(code)}`)
    }
  })

  const ret = injectionCodes.join('\n')
  return ret.length > 0 ? `\n${ret}\n` : ''
}

export default function IntlifyVue(values: InjectionValues = {}): Plugin {
  let config: ResolvedConfig | null = null

  return {
    enforce: 'post',
    name: 'vite-plugin-vue-i18n:intlify-vue',
    configResolved(_config: ResolvedConfig) {
      config = _config
    },
    transform(code: string, id: string) {
      debug('transform', id)
      if (id.endsWith('.vue')) {
        const magic = new MagicString(code)
        const indentifier = '_sfc_main'
        const index = code.indexOf(`export default ${indentifier}`)
        magic.appendLeft(index, generateCode(values, indentifier, id, config!))
        return {
          code: magic.toString(),
          map: magic.generateMap()
        }
      }
    }
  }
}
