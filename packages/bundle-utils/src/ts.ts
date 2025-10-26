/**
 * Code generator for i18n ts resource
 *
 * A wrapper for the js generator which transforms ts to js before generating
 */

import { Node } from 'estree'
import { transform } from 'oxc-transform'
import { CodeGenOptions, CodeGenResult } from './codegen'
import { DEFAULT_OPTIONS, generate as generateJavaScript } from './js'

/**
 * @internal
 */
export function generate(
  targetSource: string | Buffer,
  options: CodeGenOptions
): CodeGenResult<Node> {
  let value = Buffer.isBuffer(targetSource) ? targetSource.toString() : targetSource

  const _options = Object.assign({}, DEFAULT_OPTIONS, options, { source: value })

  const transformed = transform(_options.filename ?? '', value, { lang: 'ts' })
  if (transformed && transformed.code) {
    value = transformed.code
    _options.source = transformed.code
  }

  return generateJavaScript(value, _options)
}
