import { ParsedUrlQuery } from 'querystring'
import JSON5 from 'json5'
import yaml from 'js-yaml'

export function createBridgeCodeGenerator(
  source: string | Buffer,
  query: ParsedUrlQuery
): () => string {
  return () => {
    const data = convert(source, query.lang as string)
    let value = JSON.parse(data)

    if (query.locale && typeof query.locale === 'string') {
      value = Object.assign({}, { [query.locale]: value })
    }

    return JSON.stringify(value)
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
      .replace(/\\/g, '\\\\')
      .replace(/\u0027/g, '\\u0027')
  }
}

function convert(source: string | Buffer, lang: string): string {
  const value = Buffer.isBuffer(source) ? source.toString() : source

  switch (lang) {
    case 'yaml':
    case 'yml':
      const data = yaml.load(value)
      return JSON.stringify(data, undefined, '\t')
    case 'json5':
      return JSON.stringify(JSON5.parse(value))
    default:
      return value
  }
}
