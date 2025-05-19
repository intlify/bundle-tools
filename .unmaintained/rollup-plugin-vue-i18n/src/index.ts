import qs from 'querystring'
import path from 'path'
import { isString } from '@intlify/shared'
import { createFilter } from '@rollup/pluginutils'
import { generateJSON, generateYAML } from '@intlify/bundle-utils'
import { Plugin } from 'rollup'
import { debug as Debug } from 'debug'

const debug = Debug('rollup-plugin-vue-i18n')

import type { CodeGenOptions, DevEnv } from '@intlify/bundle-utils'
import type { RollupPluginVueI18nOptions } from './options'

type Query = {
  filename: string
  vue: boolean
  type?: 'script' | 'template' | 'style' | 'custom'
  lang?: string
  src?: boolean
  id?: string
  index?: number
  scoped?: boolean
  module?: string | boolean
  [key: string]: unknown
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function i18n(
  options: RollupPluginVueI18nOptions = { forceStringify: false }
): Plugin {
  debug('options', options)
  const filter = createFilter(options.include)

  return {
    name: 'rollup-plugin-vue-i18n',

    transform(source: string, id: string) {
      debug('transform source', source)
      debug('transform id', id)
      const query = parseVuePartRequest(id)
      debug('transform query', query)
      const { filename } = query
      debug('condition', /\.(json5?|ya?ml)$/.test(filename) && filter(filename))
      if (
        isCustomBlock(query) ||
        (/\.(json5?|ya?ml)$/.test(filename) && filter(filename))
      ) {
        const parseOptions = getOptions(
          query,
          options.forceStringify
        ) as CodeGenOptions
        debug('getOptions', parseOptions)

        const langInfo = isCustomBlock(query)
          ? isString(query.lang) && query.lang !== 'i18n'
            ? query.lang
            : 'json'
          : path.parse(filename).ext
        debug('langInfo', langInfo)

        const generate = /json5?/.test(langInfo) ? generateJSON : generateYAML
        const { code } = generate(source, parseOptions)
        debug('code', code)
        // TODO: source-map
        return {
          code,
          map: {
            mappings: ''
          }
        }
      } else {
        return null
      }
    }
  }
}

function isCustomBlock(query: Query): boolean {
  // NOTE: set query type 'i18n' with rollup-plugin-vue
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return query.vue && (query as any)['type'] === 'i18n'
}

function getOptions(
  query: Query,
  forceStringify = false
): Record<string, unknown> {
  const { filename } = query
  const mode: DevEnv =
    process.env.NODE_ENV === 'production' || process.env.BUILD === 'production'
      ? 'production'
      : 'development'

  const baseOptions = {
    filename,
    forceStringify,
    env: mode as DevEnv,
    onWarn: (msg: string): void => {
      console.warn(`[rollup-plugin-vue-i18n]: ${filename} ${msg}`)
    },
    onError: (msg: string): void => {
      console.error(`[rollup-plugin-vue-i18n]: ${filename} ${msg}`)
    }
  }

  if (isCustomBlock(query)) {
    return Object.assign(baseOptions, {
      type: 'sfc',
      locale: isString(query.locale) ? query.locale : '',
      isGlobal: query.global != null
    })
  } else {
    return Object.assign(baseOptions, {
      type: 'plain',
      isGlobal: false
    })
  }
}

function parseVuePartRequest(id: string): Query {
  const [filename, query] = id.split('?', 2)

  if (!query) {
    return { vue: false, filename }
  }

  const raw = qs.parse(query)

  if ('vue' in raw) {
    const langPart = Object.keys(raw).find(key => /lang\./i.test(key))
    const part = {
      ...raw,
      filename,
      vue: true,
      index: Number(raw.index),
      src: 'src' in raw,
      scoped: 'scoped' in raw
    } as Query

    if (langPart) {
      const [, lang] = langPart.split('.')
      part.lang = lang
    }

    return part
  }

  return { vue: false, filename }
}
