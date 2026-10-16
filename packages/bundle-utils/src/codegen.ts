import { baseCompile, detectHtmlTag, LOCATION_STUB } from '@intlify/message-compiler'
import * as messageCompiler from '@intlify/message-compiler'
import {
  format,
  friendlyJSONstringify,
  isBoolean,
  escapeHtml as sanitizeHtml
} from '@intlify/shared'
import { SourceMapConsumer, SourceMapGenerator } from 'source-map-js'

import type { CompileError, CompileOptions, ResourceNode } from '@intlify/message-compiler'
import type { MappedPosition, MappingItem, RawSourceMap } from 'source-map-js'

/**
 * Compilation dev environments
 *
 * @public
 */
export type DevEnv = 'development' | 'production'

interface Position {
  line: number
  column: number
  offset?: number
}

interface SourceLocationable {
  start?: number
  loc?: {
    start: Position
    end: Position
  } | null
}

/**
 * @internal
 */
export interface CodeGenOptions {
  type?: 'plain' | 'sfc' | 'bare'
  exportESM?: boolean
  onlyLocales?: string[]
  source?: string
  sourceMap?: boolean
  filename?: string
  inSourceMap?: RawSourceMap
  isGlobal?: boolean
  locale?: string
  env?: DevEnv
  forceStringify?: boolean
  allowDynamic?: boolean
  strictMessage?: boolean
  escapeHtml?: boolean
  jit?: boolean
  minify?: boolean
  transformI18nBlock?: (source: string | Buffer) => string
  onWarn?: (msg: string) => void
  onError?: (
    msg: string,
    extra?: {
      source: string
      path: string
      code?: CompileError['code']
      domain?: CompileError['domain']
      location?: CompileError['location']
    }
  ) => void
}

interface CodeGenContext {
  source?: string
  code: string
  indentLevel: number
  filename: string
  line: number
  column: number
  offset: number
  env: DevEnv
  forceStringify: boolean
  map?: SourceMapGenerator
}

export interface CodeGenerator {
  context(): CodeGenContext
  push<Node extends SourceLocationable>(code: string, node?: Node, name?: string): void
  indent(withNewLine?: boolean): void
  deindent(withNewLine?: boolean): void
  newline(): void
  pushline<Node extends SourceLocationable>(code: string, node?: Node, name?: string): void
}

export interface CodeGenResult<ASTNode, CodeGenError extends Error = Error> {
  code: string
  ast: ASTNode
  errors?: CodeGenError[]
  map?: RawSourceMap
}

export type CodeGenFunction = (
  msg: string,
  options: CodeGenOptions,
  path?: string[]
) => CodeGenResult<ResourceNode>

export function createCodeGenerator(
  options: CodeGenOptions = {
    filename: 'bundle.json',
    sourceMap: false,
    env: 'development',
    forceStringify: false
  }
): CodeGenerator {
  const { sourceMap, source, filename } = options
  const _context = Object.assign(
    {
      code: '',
      column: 1,
      line: 1,
      offset: 0,
      map: undefined,
      indentLevel: 0
    },
    options
  ) as CodeGenContext

  const context = (): CodeGenContext => _context

  function push<Node extends SourceLocationable>(code: string, node?: Node, name?: string): void {
    _context.code += code
    if (_context.map && node) {
      if (node.loc && node.loc !== LOCATION_STUB) {
        addMapping(node.loc.start, name)
      }
      advancePositionWithSource(_context as Position, code)
    }
  }

  function _newline(n: number): void {
    push('\n' + `  `.repeat(n))
  }

  function indent(withNewLine = true): void {
    const level = ++_context.indentLevel
    withNewLine && _newline(level)
  }

  function deindent(withNewLine = true): void {
    const level = --_context.indentLevel
    withNewLine && _newline(level)
  }

  function newline(): void {
    _newline(_context.indentLevel)
  }

  function pushline<Node extends SourceLocationable>(
    code: string,
    node?: Node,
    name?: string
  ): void {
    push(code, node, name)
    newline()
  }

  function addMapping(loc: Position, name?: string) {
    _context.map!.addMapping({
      name,
      source: _context.filename,
      original: {
        line: loc.line,
        column: loc.column - 1
      },
      generated: {
        line: _context.line,
        column: _context.column - 1
      }
    })
  }

  if (sourceMap && source) {
    _context.map = new SourceMapGenerator()
    _context.map.setSourceContent(filename!, source)
  }

  return {
    context,
    push,
    indent,
    deindent,
    newline,
    pushline
  }
}

function advancePositionWithSource(
  pos: Position,
  source: string,
  numberOfCharacters: number = source.length
): Position {
  if (pos.offset == null) {
    return pos
  }

  let linesCount = 0
  let lastNewLinePos = -1
  for (let i = 0; i < numberOfCharacters; i++) {
    if (source.charCodeAt(i) === 10 /* newline char code */) {
      linesCount++
      lastNewLinePos = i
    }
  }

  pos.offset += numberOfCharacters
  pos.line += linesCount
  pos.column =
    lastNewLinePos === -1 ? pos.column + numberOfCharacters : numberOfCharacters - lastNewLinePos

  return pos
}

const DETECT_MESSAGE = `Detected HTML in '{msg}' message.`
const ON_ERROR_NOOP = () => {}

function parsePath(path?: string[]): string {
  return path ? path.join('.') : ''
}

// The text of each message compiler error, by code. The message compiler exports it but leaves it
// out of its type declarations, so read it off the namespace (it is undefined if it ever goes away)
const COMPILE_ERROR_MESSAGES = (
  messageCompiler as unknown as { errorMessages?: Record<number, string> }
).errorMessages

/**
 * The text of a message compiler error. The message compiler leaves only the error code in the
 * message when `NODE_ENV` is `production` (as during `vite build`), so put the text back. The
 * arguments of the text are gone by then, so their placeholders go too.
 */
function getCompileErrorMessage(err: CompileError): string {
  if (err.message !== String(err.code)) {
    return err.message
  }
  const text = COMPILE_ERROR_MESSAGES?.[err.code]
  return text ? text.replace(/:\s*\\?'?\{\d+\}'?/g, '') : err.message
}

export function generateMessageFunction(
  msg: string,
  options: CodeGenOptions = {},
  path?: string[]
): CodeGenResult<ResourceNode> {
  const env = options.env != null ? options.env : 'development'
  const strictMessage = isBoolean(options.strictMessage) ? options.strictMessage : true
  const escapeHtml = !!options.escapeHtml
  const onError = options.onError || ON_ERROR_NOOP
  const errors = [] as CompileError[]

  let detecteHtmlInMsg = false
  if (detectHtmlTag(msg)) {
    detecteHtmlInMsg = true
    if (strictMessage) {
      const errMsg = format(DETECT_MESSAGE, { msg })
      onError(format(errMsg), {
        source: msg,
        path: parsePath(path)
      })
    }
  }

  const _msg = detecteHtmlInMsg && escapeHtml ? sanitizeHtml(msg) : msg

  const newOptions = Object.assign({ mode: 'arrow' }, options) as CompileOptions
  newOptions.onError = (err: CompileError): void => {
    if (onError) {
      const extra: Parameters<Required<CodeGenOptions>['onError']>[1] = {
        source: msg,
        path: parsePath(path),
        code: err.code,
        domain: err.domain,
        location: err.location
      }
      onError(getCompileErrorMessage(err), extra)
      errors.push(err)
    }
  }
  const { code, ast, map } = baseCompile(_msg, newOptions)
  const occured = errors.length > 0
  const genCode = !occured
    ? env === 'development'
      ? `(()=>{const fn=${code};fn.source=${JSON.stringify(msg)};return fn;})()`
      : `${code}`
    : `\`${_msg}\``
  return { code: genCode, ast, map, errors }
}

export function mapLinesColumns(
  resMap: RawSourceMap,
  codeMaps: Map<string, RawSourceMap>,
  inSourceMap?: RawSourceMap
): RawSourceMap | null {
  if (!resMap) {
    return null
  }

  const resMapConsumer = new SourceMapConsumer(resMap)
  const inMapConsumer = inSourceMap ? new SourceMapConsumer(inSourceMap) : null
  const mergedMapGenerator = new SourceMapGenerator()

  type NonNullableMappingItem = MappingItem & {
    originalLine: number
    originalColumn: number
  }

  let inMapFirstItem: NonNullableMappingItem | null = null
  if (inMapConsumer) {
    inMapConsumer.eachMapping(m => {
      if (inMapFirstItem) {
        return
      }
      if (m.originalLine == null || m.originalColumn == null) {
        return
      }
      inMapFirstItem = m as NonNullableMappingItem
    })
  }

  resMapConsumer.eachMapping(res => {
    const resOriginalLine = res.originalLine
    const resOriginalColumn = res.originalColumn
    const resName = res.name
    if (resOriginalLine == null || resOriginalColumn == null || resName == null) {
      return
    }

    const map = codeMaps.get(resName)
    if (!map) {
      return
    }

    let inMapOrigin: MappedPosition | null = null
    if (inMapConsumer) {
      inMapOrigin = inMapConsumer.originalPositionFor({
        line: resOriginalLine,
        column: resOriginalColumn - 1
      })
      if (inMapOrigin.source == null) {
        inMapOrigin = null
        return
      }
    }

    const inMapFirst = inMapFirstItem
    const mapConsumer = new SourceMapConsumer(map)
    mapConsumer.eachMapping(m => {
      mergedMapGenerator.addMapping({
        original: {
          line: inMapFirst ? inMapFirst.originalLine + resOriginalLine - 2 : resOriginalLine,
          column: inMapFirst ? inMapFirst.originalColumn + resOriginalColumn : resOriginalColumn
        },
        generated: {
          line: inMapFirst ? inMapFirst.generatedLine + resOriginalLine - 2 : resOriginalLine,
          // map column with message format compilation code map
          column: inMapFirst
            ? inMapFirst.generatedColumn + resOriginalColumn + m.generatedColumn
            : resOriginalColumn + m.generatedColumn
        },
        source: inMapOrigin ? inMapOrigin.source : res.source,
        name: m.name // message format compilation code
      })
    })
  })

  const generator = mergedMapGenerator as any
  // const targetConsumer = inMapConsumer || resMapConsumer
  const targetConsumer = inMapConsumer || resMapConsumer

  ;(targetConsumer as any).sources.forEach((sourceFile: string) => {
    generator._sources.add(sourceFile)
    const sourceContent = targetConsumer.sourceContentFor(sourceFile)
    if (sourceContent != null) {
      mergedMapGenerator.setSourceContent(sourceFile, sourceContent)
    }
  })

  generator._sourceRoot = inSourceMap ? inSourceMap.sourceRoot : resMap.sourceRoot
  generator._file = inSourceMap ? inSourceMap.file : resMap.file

  return generator.toJSON()
}

export function generateResourceAst(
  msg: string,
  options: CodeGenOptions = {},
  path?: string[]
): CodeGenResult<ResourceNode> {
  const env = options.env != null ? options.env : 'development'
  const strictMessage = isBoolean(options.strictMessage) ? options.strictMessage : true
  const escapeHtml = !!options.escapeHtml
  const onError = options.onError || ON_ERROR_NOOP
  const errors = [] as CompileError[]

  let detecteHtmlInMsg = false
  if (detectHtmlTag(msg)) {
    detecteHtmlInMsg = true
    if (strictMessage) {
      const errMsg = format(DETECT_MESSAGE, { msg })
      onError(format(errMsg), {
        source: msg,
        path: parsePath(path)
      })
    }
  }

  const _msg = detecteHtmlInMsg && escapeHtml ? sanitizeHtml(msg) : msg

  const newOptions = Object.assign(
    {
      location: env === 'development',
      minify: isBoolean(options.minify) ? options.minify : env === 'production'
    },
    options
  ) as CompileOptions

  if (newOptions.jit != null) {
    newOptions.jit = true
  }

  newOptions.onError = (err: CompileError): void => {
    if (onError) {
      const extra: Parameters<Required<CodeGenOptions>['onError']>[1] = {
        source: msg,
        path: parsePath(path),
        code: err.code,
        domain: err.domain,
        location: err.location
      }
      onError(getCompileErrorMessage(err), extra)
      errors.push(err)
    }
  }
  const { ast, map } = baseCompile(_msg, newOptions)
  const occured = errors.length > 0
  const code = !occured ? `${friendlyJSONstringify(ast)}` : `\`${_msg}\``
  return { code, ast, map, errors }
}

function describeResource({ type, filename }: CodeGenOptions): string {
  return type === 'sfc' ? `the i18n custom block of ${filename}` : `${filename}`
}

/**
 * @internal
 */
export function describeValue(value: unknown): string {
  if (Array.isArray(value)) return 'an array'
  if (value === undefined) return 'undefined'
  return `a ${typeof value}`
}

/**
 * Write a value that is not a string as JavaScript code
 *
 * @remarks
 * `JSON.stringify` writes `Infinity` and `NaN` as `null`, and `-0` as `0`.
 *
 * @internal
 */
export function stringifyValue(value: unknown): string {
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : String(value)
  if (value === undefined) return 'undefined'
  return JSON.stringify(value)
}

/**
 * @internal
 */
export function createResourceError(message: string, options: CodeGenOptions): Error {
  return new Error(`${message} in ${describeResource(options)}.`)
}

/**
 * @internal
 */
export function createResourceParseError(
  err: unknown,
  options: CodeGenOptions,
  columnOffset = 0
): unknown {
  if (!(err instanceof Error)) return err
  const { lineNumber, column } = err as Error & { lineNumber?: number; column?: number }
  const position = lineNumber != null ? ` (${lineNumber}:${column! + columnOffset})` : ''
  return new SyntaxError(`${err.message} in ${describeResource(options)}${position}`, {
    cause: err
  })
}

/**
 * The part of an error of oxc-parser and oxc-transform that is used here
 *
 * @internal
 */
export interface OxcErrorLike {
  severity: string
  message: string
  labels: { start: number }[]
}

/**
 * Make the syntax error of a JS / TS resource from the errors that oxc reports
 *
 * @remarks
 * `parseSync` of oxc-parser and `transform` of oxc-transform do not throw on a syntax error.
 * They return the errors in `errors`, with an empty result.
 * oxc-parser counts the offsets of the errors in UTF-16 code units, and oxc-transform counts them in UTF-8 bytes.
 *
 * @internal
 */
export function createOxcParseError(
  errors: OxcErrorLike[],
  source: string,
  options: CodeGenOptions,
  offsetUnit: 'utf-16' | 'utf-8' = 'utf-16'
): unknown {
  const error = errors.find(e => e.severity === 'Error') ?? errors[0]
  const err = new Error(error.message) as Error & { lineNumber?: number; column?: number }
  const start = error.labels[0]?.start
  if (start != null) {
    const before =
      offsetUnit === 'utf-8'
        ? Buffer.from(source).subarray(0, start).toString()
        : source.slice(0, start)
    err.lineNumber = before.split('\n').length
    err.column = before.length - before.lastIndexOf('\n')
  }
  return createResourceParseError(err, options)
}

export function excludeLocales({
  messages,
  onlyLocales
}: {
  messages: Record<string, unknown>
  onlyLocales: string[]
}) {
  const _messages = { ...messages }

  Object.keys(_messages).forEach(locale => {
    if (!onlyLocales.includes(locale)) {
      delete _messages[locale]
    }
  })

  return _messages
}
