/**
 * Code generator for i18n js resource
 */

import { isString, isBoolean, isNumber } from '@intlify/shared'
import { parse as parseJavaScript } from 'acorn'
import { generate as generateJavaScript } from 'escodegen'
import { walk } from 'estree-walker'
import {
  createCodeGenerator,
  generateMessageFunction,
  generateResourceAst,
  mapLinesColumns
} from './codegen'

import type { RawSourceMap } from 'source-map-js'
import type { Node } from 'estree'
import type {
  CodeGenOptions,
  CodeGenerator,
  CodeGenResult,
  CodeGenFunction
} from './codegen'

/**
 * @internal
 */
export function generate(
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
    strictMessage = true,
    escapeHtml = false,
    allowDynamic = false,
    jit = false
  }: CodeGenOptions
): CodeGenResult<Node> {
  const target = Buffer.isBuffer(targetSource)
    ? targetSource.toString()
    : targetSource
  const value = target

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
    strictMessage,
    escapeHtml,
    jit
  } as CodeGenOptions
  const generator = createCodeGenerator(options)

  const ast = parseJavaScript(value, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    sourceFile: filename,
    allowImportExportEverywhere: true
  }) as Node

  const exportResult = scanAst(ast)
  if (!allowDynamic) {
    // if (!astExportDefaultWithObject.length) {
    if (!exportResult || exportResult !== 'object') {
      throw new Error(
        `You need to define an object as the locale message with 'export default'.`
      )
    }
  } else {
    if (!exportResult) {
      throw new Error(
        `You need to define 'export default' that will return the locale messages.`
      )
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
        map: inSourceMap
      }
    }
  }

  const codeMaps = _generate(generator, ast, options)

  const { code, map } = generator.context()
  // if (map) {
  //   const s = new SourceMapConsumer((map as any).toJSON())
  //   s.eachMapping(m => {
  //     console.log('sourcemap json', m)
  //   })
  // }
  // prettier-ignore
  const newMap = map
    ? mapLinesColumns((map as any).toJSON(), codeMaps, inSourceMap) || null  
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

  let ret: false | 'object' | 'function' | 'arrow-function' = false
  for (const node of ast.body) {
    if (node.type === 'ExportDefaultDeclaration') {
      if (node.declaration.type === 'ObjectExpression') {
        ret = 'object'
        break
      } else if (node.declaration.type === 'FunctionDeclaration') {
        ret = 'function'
        break
      } else if (node.declaration.type === 'ArrowFunctionExpression') {
        ret = 'arrow-function'
        break
      }
    }
  }
  return ret
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

  const _codegenFn: CodeGenFunction = jit
    ? generateResourceAst
    : generateMessageFunction

  function codegenFn(value: string) {
    const { code, map } = _codegenFn(value, options, pathStack)
    sourceMap && map != null && codeMaps.set(value, map)
    return code
  }

  const componentNamespace = '_Component'

  walk(node, {
    /**
     * NOTE:
     *  force cast to Node of `estree-walker@3.x`,
     *  because `estree-walker@3.x` is not dual packages,
     *  so it's support only esm only ...
     */
    // @ts-ignore
    enter(node: Node, parent: Node) {
      if (parent?.type === 'ArrayExpression') {
        const lastIndex = itemsCountStack.length - 1
        const currentCount = parent.elements.length - itemsCountStack[lastIndex]

        pathStack.push(currentCount.toString())
        itemsCountStack[lastIndex] = --itemsCountStack[lastIndex]
      }

      switch (node.type) {
        case 'Program':
          if (type === 'plain') {
            generator.push(`const resource = `)
          } else if (type === 'sfc') {
            const localeName = JSON.stringify(locale ?? '')
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
          if (node.key.type !== 'Literal' && node.key.type !== 'Identifier')
            break

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
            // for Regex, function, etc.
            skipStack.push(true)
          }
          const lastIndex = propsCountStack.length - 1
          propsCountStack[lastIndex] = --propsCountStack[lastIndex]
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

      if (
        parent?.type === 'ArrayExpression' ||
        parent?.type === 'ObjectExpression'
      ) {
        const stackArr =
          node.type === 'Property' ? propsCountStack : itemsCountStack
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
