/**
 * Code generator for i18n ts resource
 *
 * An async wrapper for the js generator which transforms ts to js before generating
 */

import { transform } from 'esbuild'
import { Node } from 'estree'
import { CodeGenOptions, CodeGenResult } from './codegen'
import { DEFAULT_OPTIONS, generate as generateJavaScript } from './js'

/**
 * @internal
 */
export async function generate(
  targetSource: string | Buffer,
  options: CodeGenOptions
): Promise<CodeGenResult<Node>> {
  let value = Buffer.isBuffer(targetSource) ? targetSource.toString() : targetSource

  const _options = Object.assign({}, DEFAULT_OPTIONS, options, {
    source: value
  })
  // the source is TypeScript whatever its filename is: a custom block of an SFC has the filename
  // of the SFC
  const transformed = await transform(value, { loader: 'ts' })
  if (transformed && transformed.code) {
    value = transformed.code
    _options.source = transformed.code
  }

  return generateJavaScript(value, _options)
}
