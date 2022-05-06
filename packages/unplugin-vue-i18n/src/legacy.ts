import { isString } from '@intlify/shared'
import JSON5 from 'json5'
import yaml from 'js-yaml'

import type { SFCLangFormat } from './types'
import type { VueQuery } from './query'

export function createBridgeCodeGenerator(
  source: string,
  query: VueQuery
): () => string {
  return () => {
    const data = convert(source, query.lang as SFCLangFormat)
    let value = JSON.parse(data)

    if (isString(query.locale)) {
      value = Object.assign({}, { [query.locale]: value })
    }

    return JSON.stringify(value)
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
      .replace(/\\/g, '\\\\')
      .replace(/\u0027/g, '\\u0027')
  }
}

function convert(source: string, lang: SFCLangFormat): string {
  switch (lang) {
    case 'yaml':
    case 'yml':
      const data = yaml.load(source)
      return JSON.stringify(data, undefined, '\t')
    case 'json5':
      return JSON.stringify(JSON5.parse(source))
    default:
      return source
  }
}
