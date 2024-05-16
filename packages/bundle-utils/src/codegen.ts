import { SourceMapGenerator, SourceMapConsumer } from 'source-map-js'
import {
  format,
  escapeHtml as sanitizeHtml,
  isBoolean,
  friendlyJSONstringify
} from '@intlify/shared'
import {
  baseCompile,
  detectHtmlTag,
  LOCATION_STUB
} from '@intlify/message-compiler'

import type { RawSourceMap, MappedPosition, MappingItem } from 'source-map-js'
import type {
  CompileError,
  ResourceNode,
  CompileOptions
} from '@intlify/message-compiler'

/**
 * Compilation dev environments
 *
 * @public
 */
export type DevEnv = 'development' | 'production'

export interface Position {
  line: number
  column: number
  offset?: number
}

export interface SourceLocationable {
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
  legacy?: boolean
  bridge?: boolean
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

export interface CodeGenContext {
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
  push<Node extends SourceLocationable>(
    code: string,
    node?: Node,
    name?: string
  ): void
  indent(withNewLine?: boolean): void
  deindent(withNewLine?: boolean): void
  newline(): void
  pushline<Node extends SourceLocationable>(
    code: string,
    node?: Node,
    name?: string
  ): void
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

  function push<Node extends SourceLocationable>(
    code: string,
    node?: Node,
    name?: string
  ): void {
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
    lastNewLinePos === -1
      ? pos.column + numberOfCharacters
      : numberOfCharacters - lastNewLinePos

  return pos
}

const DETECT_MESSAGE = `Detected HTML in '{msg}' message.`
const ON_ERROR_NOOP = () => {} // eslint-disable-line @typescript-eslint/no-empty-function

function parsePath(path?: string[]): string {
  return path ? path.join('.') : ''
}

export function generateMessageFunction(
  msg: string,
  options: CodeGenOptions = {},
  path?: string[]
): CodeGenResult<ResourceNode> {
  const env = options.env != null ? options.env : 'development'
  const strictMessage = isBoolean(options.strictMessage)
    ? options.strictMessage
    : true
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
      onError(err.message, extra)
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

  let inMapFirstItem: MappingItem | null = null
  if (inMapConsumer) {
    inMapConsumer.eachMapping(m => {
      if (inMapFirstItem) {
        return
      }
      inMapFirstItem = m
    })
  }

  resMapConsumer.eachMapping(res => {
    if (res.originalLine == null) {
      return
    }

    const map = codeMaps.get(res.name)
    if (!map) {
      return
    }

    let inMapOrigin: MappedPosition | null = null
    if (inMapConsumer) {
      inMapOrigin = inMapConsumer.originalPositionFor({
        line: res.originalLine,
        column: res.originalColumn - 1
      })
      if (inMapOrigin.source == null) {
        inMapOrigin = null
        return
      }
    }

    const mapConsumer = new SourceMapConsumer(map)
    mapConsumer.eachMapping(m => {
      mergedMapGenerator.addMapping({
        original: {
          line: inMapFirstItem
            ? inMapFirstItem.originalLine + res.originalLine - 2
            : res.originalLine,
          column: inMapFirstItem
            ? inMapFirstItem.originalColumn + res.originalColumn
            : res.originalColumn
        },
        generated: {
          line: inMapFirstItem
            ? inMapFirstItem.generatedLine + res.originalLine - 2
            : res.originalLine,
          // map column with message format compilation code map
          column: inMapFirstItem
            ? inMapFirstItem.generatedColumn +
              res.originalColumn +
              m.generatedColumn
            : res.originalColumn + m.generatedColumn
        },
        source: inMapOrigin ? inMapOrigin.source : res.source,
        name: m.name // message format compilation code
      })
    })
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generator = mergedMapGenerator as any
  // const targetConsumer = inMapConsumer || resMapConsumer
  const targetConsumer = inMapConsumer || resMapConsumer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(targetConsumer as any).sources.forEach((sourceFile: string) => {
    generator._sources.add(sourceFile)
    const sourceContent = targetConsumer.sourceContentFor(sourceFile)
    if (sourceContent != null) {
      mergedMapGenerator.setSourceContent(sourceFile, sourceContent)
    }
  })

  generator._sourceRoot = inSourceMap
    ? inSourceMap.sourceRoot
    : resMap.sourceRoot
  generator._file = inSourceMap ? inSourceMap.file : resMap.file

  return generator.toJSON()
}

export function generateResourceAst(
  msg: string,
  options: CodeGenOptions = {},
  path?: string[]
): CodeGenResult<ResourceNode> {
  const env = options.env != null ? options.env : 'development'
  const strictMessage = isBoolean(options.strictMessage)
    ? options.strictMessage
    : true
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
      onError(err.message, extra)
      errors.push(err)
    }
  }
  const { ast, map } = baseCompile(_msg, newOptions)
  const occured = errors.length > 0
  const code = !occured ? `${friendlyJSONstringify(ast)}` : `\`${_msg}\``
  return { code, ast, map, errors }
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
