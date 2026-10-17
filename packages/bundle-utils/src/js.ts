/**
 * Code generator for i18n js resource
 */

import { isBoolean, isNumber, isString } from '@intlify/shared'
import { parse as parseJavaScript } from 'acorn'
import {
  createCodeGenerator,
  generateMessageFunction,
  generateResourceAst,
  mapLinesColumns
} from './codegen'

import type { ExportDefaultDeclaration, Identifier, Literal, Node, Program, Property } from 'estree'
import type { RawSourceMap } from 'source-map-js'
import type { CodeGenerator, CodeGenFunction, CodeGenOptions, CodeGenResult } from './codegen'

export class DynamicResourceError extends Error {}

/**
 * @internal
 */
export const DEFAULT_OPTIONS: CodeGenOptions = {
  type: 'plain',
  filename: 'vue-i18n-loader.js',
  inSourceMap: undefined,
  locale: '',
  isGlobal: false,
  sourceMap: false,
  env: 'development',
  forceStringify: false,
  onError: undefined,
  onWarn: undefined,
  strictMessage: true,
  escapeHtml: false,
  allowDynamic: false,
  jit: false
}

/**
 * @internal
 */
export function generate(
  targetSource: string | Buffer,
  options: CodeGenOptions
): CodeGenResult<Node> {
  const value = Buffer.isBuffer(targetSource) ? targetSource.toString() : targetSource

  const _options = Object.assign({}, DEFAULT_OPTIONS, options, {
    source: value
  })
  const generator = createCodeGenerator(_options)
  const ast = parseJavaScript(value, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    sourceFile: _options.filename,
    allowImportExportEverywhere: true
  }) as Node

  const exportResult = scanAst(ast)
  if (!_options.allowDynamic) {
    if (!exportResult) {
      throw new Error(`You need to define an object as the locale message with 'export default'.`)
    }

    if (exportResult !== 'object') {
      // using custom error to gracefully deal with error in virtual file
      throw new DynamicResourceError(
        `You need to define an object as the locale message with 'export default'.`
      )
    }
  } else {
    if (!exportResult) {
      throw new Error(`You need to define 'export default' that will return the locale messages.`)
    }

    if (exportResult !== 'object') {
      /**
       * NOTE:
       *  If `allowDynamic` is `true`, do not transform the code by this function, return it as is.
       *  This means that the user **must transform locale messages ownself**.
       *  Especially at the production, you need to do locale messages pre-compiling.
       */
      return {
        ast,
        code: value,
        map: _options.inSourceMap
      }
    }
  }

  const codeMaps = _generate(generator, ast, _options)

  const { code, map } = generator.context()
  // prettier-ignore
  const newMap = map
    ? mapLinesColumns((map as any).toJSON(), codeMaps, _options.inSourceMap) || null
    : null
  return {
    ast,
    code,
    map: newMap != null ? newMap : undefined
  }
}

function scanAst(ast: Node) {
  if (ast.type !== 'Program') {
    throw new Error('Invalid AST: does not have Program node')
  }

  for (const node of ast.body) {
    if (node.type !== 'ExportDefaultDeclaration') continue

    switch (node.declaration.type) {
      case 'ObjectExpression':
        return 'object'
      case 'FunctionDeclaration':
        return 'function'
      case 'ArrowFunctionExpression':
        return 'arrow-function'
      // we need to optimize top-level variables to support this
      // case 'Identifier':
      //   return 'object'
    }
  }

  return false
}

function _generate(
  generator: CodeGenerator,
  node: Node,
  options: CodeGenOptions = {}
): Map<string, RawSourceMap> {
  const { forceStringify } = generator.context()
  const codeMaps = new Map<string, RawSourceMap>()
  const { type, sourceMap, isGlobal, locale, jit } = options
  const source = options.source ?? ''

  const _codegenFn: CodeGenFunction = jit ? generateResourceAst : generateMessageFunction

  function codegenFn(value: string, path: string[]) {
    const { code, map } = _codegenFn(value, options, path)
    sourceMap && map != null && codeMaps.set(value, map)
    return code
  }

  const componentNamespace = '_Component'
  const variableDeclarations: string[] = []
  const { body } = node as Program
  // `scanAst` has checked that the default export is an object
  const exportDefault = body.find(
    (statement): statement is ExportDefaultDeclaration =>
      statement.type === 'ExportDefaultDeclaration'
  )!
  const resource = exportDefault.declaration as Node

  // keep the other top-level statements (imports, variables, functions, ...) as they are
  // NOTE: this prevents optimization/compilation of top-level variables, we may be able to add support for this
  for (const statement of body) {
    if (statement === exportDefault) continue
    generator.push(sourceOf(source, statement))
    generator.newline()
    if (statement.type === 'VariableDeclaration') {
      variableDeclarations.push(
        ...statement.declarations.map(x => `\`${(x.id as Identifier).name}\``)
      )
    }
  }

  if (variableDeclarations.length > 0) {
    options?.onWarn?.(
      `\nVariable declarations are not optimized - found ${variableDeclarations.join(', ')}`
    )
  }

  // compile the messages in the objects and arrays of the resource, and keep everything else in it
  // as it is in the source (identifiers, member accesses, calls, functions, spreads, regexes, ...)
  const messages: { node: Node; value: string; code: string }[] = []
  function collect(value: Node, path: string[]): void {
    if (value.type === 'ObjectExpression') {
      for (const property of value.properties) {
        // spreads, methods, getters, setters and shorthands are kept as they are
        if (
          property.type === 'Property' &&
          property.kind === 'init' &&
          !property.method &&
          !property.shorthand
        ) {
          collect(property.value, [...path, keyOf(source, property)])
        }
      }
    } else if (value.type === 'ArrayExpression') {
      value.elements.forEach((element, index) => {
        if (element != null && element.type !== 'SpreadElement') {
          collect(element, [...path, String(index)])
        }
      })
    } else if (isMessageLiteral(value)) {
      const message = getValue(value)
      if (isString(message)) {
        messages.push({ node: value, value: message, code: codegenFn(message, path) })
      } else if (forceStringify) {
        const strMessage = JSON.stringify(message)
        messages.push({ node: value, value: strMessage, code: codegenFn(strMessage, path) })
      }
    }
  }
  collect(resource, [])

  if (type === 'plain') {
    generator.push(`const resource = `)
  } else if (type === 'sfc') {
    const localeName = JSON.stringify(locale ?? '""')
    const variableName = !isGlobal ? '__i18n' : '__i18nGlobal'
    generator.push(`export default function (Component) {`)
    generator.indent()
    generator.pushline(`const ${componentNamespace} = Component`)
    generator.pushline(
      `${componentNamespace}.${variableName} = ${componentNamespace}.${variableName} || []`
    )
    generator.push(`${componentNamespace}.${variableName}.push({`)
    generator.indent()
    generator.pushline(`"locale": ${localeName},`)
    generator.push(`"resource": `)
  }

  // the resource as it is in the source, with the compiled messages in place of the messages
  let offset = rangeOf(resource).start
  for (const message of messages) {
    generator.push(source.slice(offset, rangeOf(message.node).start))
    generator.push(message.code, message.node, message.value)
    offset = rangeOf(message.node).end
  }
  generator.push(source.slice(offset, rangeOf(resource).end))

  if (type === 'plain') {
    generator.push('\n')
    generator.push('export default resource')
  } else if (type === 'sfc') {
    generator.deindent()
    generator.push('})')
    generator.deindent()
    generator.pushline('}')
  }

  return codeMaps
}

// acorn sets the range of a node on it, which the estree types do not have
function rangeOf(node: Node): { start: number; end: number } {
  return node as Node & { start: number; end: number }
}

function sourceOf(source: string, node: Node): string {
  const { start, end } = rangeOf(node)
  return source.slice(start, end)
}

// the key of a property in the path of its messages: a computed key is the source of its expression
function keyOf(source: string, property: Property): string {
  const { key } = property
  if (property.computed) {
    return sourceOf(source, key)
  }
  return key.type === 'Identifier' ? key.name : String((key as Literal).value)
}

// a string, a number, a boolean, null, or a template literal without expressions
function isMessageLiteral(node: Node): boolean {
  if (node.type === 'Literal' && 'regex' in node) {
    return false
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length > 0) {
    return false
  }
  return isJSONablePrimitiveLiteral(node)
}

function isJSONablePrimitiveLiteral(node: Node): boolean {
  return (
    (node.type === 'Literal' &&
      (isString(node.value) ||
        isNumber(node.value) ||
        isBoolean(node.value) ||
        node.value === null)) ||
    node.type === 'TemplateLiteral'
  )
  // NOTE: the following code is same the above code
  /*
  if (node.type === 'Literal') {
    if (
      isString(node.value) ||
      isNumber(node.value) ||
      isBoolean(node.value) ||
      node.value === null
    ) {
      return true
    } else if (isRegExp(node.value)) {
      return false
    } else {
      return false
    }
  } else if (node.type === 'TemplateLiteral') {
    return true
  } else {
    return false
  }
  */
}

function getValue(node: Node) {
  // prettier-ignore
  return node.type === 'Literal'
    ? node.value
    : node.type === 'TemplateLiteral'
      ? node.quasis.map(quasi => quasi.value.cooked).join('')
      : undefined
}
