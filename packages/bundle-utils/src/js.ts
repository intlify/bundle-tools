/**
 * Code generator for i18n js resource
 */

import { isBoolean, isNumber, isString } from '@intlify/shared'
import { parse as parseJavaScript } from 'acorn'
import { generate as generateJavaScript } from 'escodegen'
import { walk } from 'estree-walker'
import {
  createCodeGenerator,
  generateMessageFunction,
  generateResourceAst,
  mapLinesColumns
} from './codegen'

import type { Node } from 'estree'
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

  const _options = Object.assign({}, DEFAULT_OPTIONS, options, { source: value })
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
  const propsCountStack = [] as number[]
  const pathStack = [] as string[]
  const itemsCountStack = [] as number[]
  const skipStack = [] as boolean[]
  const { forceStringify } = generator.context()
  const codeMaps = new Map<string, RawSourceMap>()
  const { type, sourceMap, isGlobal, locale, jit } = options

  const _codegenFn: CodeGenFunction = jit ? generateResourceAst : generateMessageFunction

  function codegenFn(value: string) {
    const { code, map } = _codegenFn(value, options, pathStack)
    sourceMap && map != null && codeMaps.set(value, map)
    return code
  }

  const componentNamespace = '_Component'
  const variableDeclarations: string[] = []

  // slice and reseuse imports and top-level variable declarations as-is
  // NOTE: this prevents optimization/compilation of top-level variables, we may be able to add support for this
  walk(node, {
    /**
     * NOTE:
     *  force cast to Node of `estree-walker@3.x`,
     *  because `estree-walker@3.x` is not dual packages,
     *  so it's support only esm only ...
     */
    // @ts-ignore
    enter(node: Node, _parent) {
      if (_parent?.type != null) this.skip()
      switch (node.type) {
        case 'ExportDefaultDeclaration':
          this.skip()
          break
        case 'ImportDeclaration':
          // @ts-expect-error mismatching types
          generator.push(options.source?.slice(node.start, node.end))
          generator.newline()
          break
        case 'VariableDeclaration':
          // @ts-expect-error mismatching types
          generator.push(options.source?.slice(node.start, node.end))
          generator.newline()

          variableDeclarations.push(
            // @ts-expect-error mismatching types
            ...node.declarations.map(x => `\`${x.id.name}\``)
          )

          break
      }
    }
  })

  if (variableDeclarations.length > 0) {
    options?.onWarn?.(
      `\nVariable declarations are not optimized - found ${variableDeclarations.join(', ')}`
    )
  }

  walk(node, {
    /**
     * NOTE:
     *  force cast to Node of `estree-walker@3.x`,
     *  because `estree-walker@3.x` is not dual packages,
     *  so it's support only esm only ...
     */
    // @ts-ignore
    enter(node: Node, parent: Node) {
      // skip imports and top-level variable declarations
      if (parent?.type === 'Program') {
        switch (node.type) {
          case 'ImportDeclaration':
          case 'VariableDeclaration':
          case 'VariableDeclarator':
            this.skip()
        }
      } else if (parent?.type === 'ArrayExpression') {
        const lastIndex = itemsCountStack.length - 1
        const currentCount = parent.elements.length - itemsCountStack[lastIndex]
        pathStack.push(currentCount.toString())
        itemsCountStack[lastIndex] = --itemsCountStack[lastIndex]
      } else if (parent?.type === 'ObjectExpression') {
        const lastIndex = propsCountStack.length - 1
        propsCountStack[lastIndex] = --propsCountStack[lastIndex]
      }

      switch (node.type) {
        case 'Program':
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
          break
        case 'ObjectExpression':
          generator.push('{')
          generator.indent()
          propsCountStack.push(node.properties.length)
          break
        case 'ArrayExpression':
          generator.push('[')
          generator.indent()
          itemsCountStack.push(node.elements.length)
          break
        case 'Property':
          if (parent?.type !== 'ObjectExpression') break
          if (node.key.type !== 'Literal' && node.key.type !== 'Identifier') break

          // prettier-ignore
          const name = node.key.type === 'Literal'
            ? String(node.key.value)
            : node.key.name
          const strName = JSON.stringify(name)
          if (isJSONablePrimitiveLiteral(node.value)) {
            generator.push(`${strName}: `)
            pathStack.push(name)
            const value = getValue(node.value) as string
            const strValue = JSON.stringify(value)
            if (
              (node.value.type === 'Literal' && isString(node.value.value)) ||
              node.value.type === 'TemplateLiteral'
            ) {
              generator.push(codegenFn(value), node.value, value)
            } else if (forceStringify) {
              generator.push(codegenFn(strValue), node.value, strValue)
            } else {
              generator.push(strValue)
            }
            skipStack.push(false)
          } else if (
            node.value.type === 'ArrayExpression' ||
            node.value.type === 'ObjectExpression'
          ) {
            generator.push(`${strName}: `)
            pathStack.push(name)
            skipStack.push(false)
          } else if (
            node.value.type === 'FunctionExpression' ||
            node.value.type === 'ArrowFunctionExpression'
          ) {
            generator.push(`${strName}: `)
            pathStack.push(name)
            const code = generateJavaScript(node.value, {
              format: { compact: true }
            })
            generator.push(code, node.value, code)
            skipStack.push(false)
          } else {
            const skipProperty = 'regex' in node.value
            if (!skipProperty && node.type === 'Property') {
              const identifierName =
                (node.value.type === 'Identifier' && String(node.value.name)) ||
                (node.value.type === 'Literal' && String(node.value.value))
              generator.push(`${strName}: ${identifierName || name}`)
              skipStack.push(false)
            } else {
              // for Regex, function, etc.
              skipStack.push(true)
            }
          }
          break
        case 'SpreadElement':
          const spreadIdentifier =
            (node.argument.type === 'Identifier' && String(node.argument.name)) ||
            (node.argument.type === 'Literal' && String(node.argument.value))
          generator.push(`...${spreadIdentifier}`)
          break
        default:
          if (parent?.type === 'ArrayExpression') {
            if (isJSONablePrimitiveLiteral(node)) {
              const value = getValue(node) as string
              const strValue = JSON.stringify(value)
              if (
                (node.type === 'Literal' && isString(node.value)) ||
                node.type === 'TemplateLiteral'
              ) {
                generator.push(codegenFn(value), node, value)
              } else if (forceStringify) {
                generator.push(codegenFn(strValue), node, strValue)
              } else {
                generator.push(strValue)
              }
              skipStack.push(false)
            } else {
              // for Regex, function, etc.
              skipStack.push(true)
            }
          }
          break
      }
    },
    /**
     * NOTE:
     *  force cast to Node of `estree-walker@3.x`,
     *  because `estree-walker@3.x` is not dual packages,
     *  so it's support only esm only ...
     */
    // @ts-ignore
    leave(node: Node, parent: Node) {
      switch (node.type) {
        case 'Program':
          if (type === 'plain') {
            generator.push('\n')
            generator.push('export default resource')
          } else if (type === 'sfc') {
            generator.deindent()
            generator.push('})')
            generator.deindent()
            generator.pushline('}')
          }
          break
        case 'ObjectExpression':
          if (propsCountStack[propsCountStack.length - 1] === 0) {
            pathStack.pop()
            propsCountStack.pop()
          }
          generator.deindent()
          generator.push('}')
          break
        case 'ArrayExpression':
          if (itemsCountStack[itemsCountStack.length - 1] === 0) {
            pathStack.pop()
            itemsCountStack.pop()
          }
          generator.deindent()
          generator.push(']')
          break
        default:
          break
      }

      // if not last obj property or array value
      if (parent?.type === 'ArrayExpression' || parent?.type === 'ObjectExpression') {
        const stackArr = node.type === 'Property' ? propsCountStack : itemsCountStack
        if (stackArr[stackArr.length - 1] !== 0) {
          pathStack.pop()
          !skipStack.pop() && generator.pushline(',')
        }
      }
    }
  })

  return codeMaps
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
