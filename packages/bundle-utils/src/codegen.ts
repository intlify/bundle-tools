import {
  LocationStub,
  baseCompile,
  CompileError,
  ResourceNode,
  CompileOptions
} from '@intlify/message-compiler'
import {
  SourceMapGenerator,
  SourceMapConsumer,
  MappedPosition,
  MappingItem
} from 'source-map'

import type { RawSourceMap } from 'source-map'

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
  loc?: {
    start: Position
    end: Position
  }
}

/**
 * @internal
 */
export interface CodeGenOptions {
  type?: 'plain' | 'sfc' | 'bare'
  source?: string
  sourceMap?: boolean
  filename?: string
  inSourceMap?: RawSourceMap
  isGlobal?: boolean
  locale?: string
  env?: DevEnv
  forceStringify?: boolean
  onWarn?: (msg: string) => void
  onError?: (msg: string) => void
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

/**
 * @internal
 */
export interface CodeGenResult<ASTNode> {
  code: string
  ast: ASTNode
  map?: RawSourceMap
}

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
    if (_context.map) {
      if (node && node.loc && node.loc !== LocationStub) {
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

export function generateMessageFunction(
  msg: string,
  options: CodeGenOptions
): CodeGenResult<ResourceNode> {
  const env = options.env != null ? options.env : 'development'
  let occured = false
  const newOptions = Object.assign(options, { mode: 'arrow' }) as CompileOptions
  newOptions.onError = (err: CompileError): void => {
    options.onError && options.onError(err.message)
    occured = true
  }
  const { code, ast, map } = baseCompile(msg, newOptions)
  const genCode = !occured
    ? env === 'development'
      ? `(()=>{const fn=${code};fn.source=${JSON.stringify(msg)};return fn;})()`
      : `${code}`
    : msg
  return { code: genCode, ast, map }
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
