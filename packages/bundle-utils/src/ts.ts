/**
 * Code generator for i18n ts resource
 *
 * An async wrapper for the js generator which transforms ts to js before generating
 */

import { transform } from 'esbuild'
import { Node } from 'estree'
import { CodeGenOptions, CodeGenResult } from './codegen'
import { generate as generateJavaScript } from './js'

/**
 * @internal
 */
export async function generate(
  targetSource: string | Buffer,
  {
    type = 'plain',
    filename = 'vue-i18n-loader.js',
    inSourceMap = undefined,
    locale = '',
    isGlobal = false,
    sourceMap = false,
    env = 'development',
    forceStringify = false,
    onError = undefined,
    onWarn = undefined,
    strictMessage = true,
    escapeHtml = false,
    allowDynamic = false,
    jit = false
  }: CodeGenOptions
): Promise<CodeGenResult<Node>> {
  let value = Buffer.isBuffer(targetSource) ? targetSource.toString() : targetSource

  const options = {
    type,
    source: value,
    sourceMap,
    locale,
    isGlobal,
    inSourceMap,
    env,
    filename,
    forceStringify,
    onError,
    onWarn,
    strictMessage,
    escapeHtml,
    allowDynamic,
    jit
  } as CodeGenOptions

  if (options.filename && /.[c|m]?ts$/.test(options.filename)) {
    const transformed = await transform(value, { loader: 'ts' })

    if (transformed && transformed.code) {
      value = transformed.code
      options.source = transformed.code
    }
  }

  return generateJavaScript(value, options)
}
