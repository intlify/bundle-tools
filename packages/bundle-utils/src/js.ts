/**
 * Code generator for i18n js resource
 */

import { isString, isBoolean, isNumber } from '@intlify/shared'
import { generate as generateJavaScript } from 'escodegen'
import { walk } from 'estree-walker'
import { parse as parseJavaScript } from 'acorn'
import { transform } from '@babel/core'
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

export class DynamicResourceError extends Error {}

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
    onWarn = undefined,
    strictMessage = true,
    escapeHtml = false,
    allowDynamic = false,
    jit = false
  }: CodeGenOptions
): CodeGenResult<Node> {
  const target = Buffer.isBuffer(targetSource)
    ? targetSource.toString()
    : targetSource
  let value = target

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
    jit
  } as CodeGenOptions
  const generator = createCodeGenerator(options)

  if (options.filename && /.[c|m]?ts$/.test(options.filename)) {
    const transformed = transform(value, {
      filename: options.filename,
      sourceMaps: options.sourceMap,
      babelrc: false,
      configFile: false,
      browserslistConfigFile: false,
      comments: false,
      envName: 'development',
      presets: ['@babel/preset-typescript']
    })

    if (transformed && transformed.code) {
      value = transformed.code
      options.source = transformed.code
    }
  }

  const ast = parseJavaScript(value, {
    sourceType: 'module',
    ecmaVersion: 'latest',
    sourceFile: filename,
    allowImportExportEverywhere: true
  }) as Node

  const exportResult = scanAst(ast)
  if (!allowDynamic) {
    if (!exportResult) {
      throw new Error(
        `You need to define an object as the locale message with 'export default'.`
      )
    }

    if (exportResult !== 'object') {
      throw new DynamicResourceError(
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

  const codegenFn: CodeGenFunction = jit
    ? generateResourceAst
    : generateMessageFunction

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
            ...node.declarations.map(x => '`' + x.id.name + '`')
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
      }

      switch (node.type) {
        case 'Program':
          if (type === 'plain') {
            generator.push(`const resource = `)
          } else if (type === 'sfc') {
            // for 'sfc'
            const variableName =
              type === 'sfc' ? (!isGlobal ? '__i18n' : '__i18nGlobal') : ''
            const localeName = type === 'sfc' ? locale ?? `""` : ''
            generator.push(`export default function (Component) {`)
            generator.indent()
            generator.pushline(`const ${componentNamespace} = Component`)
            generator.pushline(
              `${componentNamespace}.${variableName} = ${componentNamespace}.${variableName} || []`
            )
            generator.push(`${componentNamespace}.${variableName}.push({`)
            generator.indent()
            generator.pushline(`"locale": ${JSON.stringify(localeName)},`)
            generator.push(`"resource": `)
          }
          break
        case 'ObjectExpression':
          generator.push(`{`)
          generator.indent()
          propsCountStack.push(node.properties.length)
          if (parent?.type === 'ArrayExpression') {
            const lastIndex = itemsCountStack.length - 1
            const currentCount =
              parent.elements.length - itemsCountStack[lastIndex]
            pathStack.push(currentCount.toString())
            itemsCountStack[lastIndex] = --itemsCountStack[lastIndex]
          }
          break
        case 'Property':
          if (parent?.type === 'ObjectExpression') {
            if (
              isJSONablePrimitiveLiteral(node.value) &&
              (node.key.type === 'Literal' || node.key.type === 'Identifier')
            ) {
              // prettier-ignore
              const name = node.key.type === 'Literal'
                ? String(node.key.value)
                : node.key.name
              if (
                (node.value.type === 'Literal' && isString(node.value.value)) ||
                node.value.type === 'TemplateLiteral'
              ) {
                const value = getValue(node.value) as string
                generator.push(`${JSON.stringify(name)}: `)
                pathStack.push(name)
                const { code, map } = codegenFn(value, options, pathStack)
                sourceMap && map != null && codeMaps.set(value, map)
                generator.push(`${code}`, node.value, value)
                skipStack.push(false)
              } else {
                const value = getValue(node.value)
                if (forceStringify) {
                  const strValue = JSON.stringify(value)
                  generator.push(`${JSON.stringify(name)}: `)
                  pathStack.push(name)
                  const { code, map } = codegenFn(strValue, options, pathStack)
                  sourceMap && map != null && codeMaps.set(strValue, map)
                  generator.push(`${code}`, node.value, strValue)
                } else {
                  generator.push(
                    `${JSON.stringify(name)}: ${JSON.stringify(value)}`
                  )
                  pathStack.push(name)
                }
                skipStack.push(false)
              }
            } else if (
              (node.value.type === 'FunctionExpression' ||
                node.value.type === 'ArrowFunctionExpression') &&
              (node.key.type === 'Literal' || node.key.type === 'Identifier')
            ) {
              // prettier-ignore
              const name = node.key.type === 'Literal'
                ? String(node.key.value)
                : node.key.name
              generator.push(`${JSON.stringify(name)}: `)
              pathStack.push(name)
              const code = generateJavaScript(node.value)
              generator.push(`${code}`, node.value, code)
              skipStack.push(false)
            } else if (
              (node.value.type === 'ObjectExpression' ||
                node.value.type === 'ArrayExpression') &&
              (node.key.type === 'Literal' || node.key.type === 'Identifier')
            ) {
              // prettier-ignore
              const name = node.key.type === 'Literal'
                ? String(node.key.value)
                : node.key.name
              generator.push(`${JSON.stringify(name)}: `)
              pathStack.push(name)
            } else {
              const skipProperty = 'regex' in node.value
              if (!skipProperty && node.type === 'Property') {
                const name =
                  (node.key.type === 'Identifier' && String(node.key.name)) ||
                  (node.key.type === 'Literal' && String(node.key.value))
                const name2 =
                  (node.value.type === 'Identifier' &&
                    String(node.value.name)) ||
                  (node.value.type === 'Literal' && String(node.value.value))

                generator.push(`${JSON.stringify(name)}: ${name2 || name}`)
                skipStack.push(false)
              } else {
                // for Regex, function, etc.
                skipStack.push(true)
              }
            }
            const lastIndex = propsCountStack.length - 1
            propsCountStack[lastIndex] = --propsCountStack[lastIndex]
          }
          break
        case 'ArrayExpression':
          generator.push(`[`)
          generator.indent()
          if (parent?.type === 'ArrayExpression') {
            const lastIndex = itemsCountStack.length - 1
            const currentCount =
              parent.elements.length - itemsCountStack[lastIndex]
            pathStack.push(currentCount.toString())
            itemsCountStack[lastIndex] = --itemsCountStack[lastIndex]
          }
          itemsCountStack.push(node.elements.length)
          break
        case 'SpreadElement':
          const name =
            (node.argument.type === 'Identifier' &&
              String(node.argument.name)) ||
            (node.argument.type === 'Literal' && String(node.argument.value))
          generator.push(`...${name}`)
          break
        default:
          if (parent?.type === 'ArrayExpression') {
            const lastIndex = itemsCountStack.length - 1
            const currentCount =
              parent.elements.length - itemsCountStack[lastIndex]

            pathStack.push(currentCount.toString())

            if (isJSONablePrimitiveLiteral(node)) {
              if (
                (node.type === 'Literal' && isString(node.value)) ||
                node.type === 'TemplateLiteral'
              ) {
                const value = getValue(node) as string
                const { code, map } = codegenFn(value, options, pathStack)
                sourceMap && map != null && codeMaps.set(value, map)
                generator.push(`${code}`, node, value)
              } else {
                const value = getValue(node)
                if (forceStringify) {
                  const strValue = JSON.stringify(value)
                  const { code, map } = codegenFn(strValue, options, pathStack)
                  sourceMap && map != null && codeMaps.set(strValue, map)
                  generator.push(`${code}`, node, strValue)
                } else {
                  generator.push(`${JSON.stringify(value)}`)
                }
              }

              skipStack.push(false)
            } else {
              // for Regex, function, etc.
              skipStack.push(true)
            }
            itemsCountStack[lastIndex] = --itemsCountStack[lastIndex]
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
          if (type === 'sfc') {
            generator.deindent()
            generator.push(`})`)
            generator.deindent()
            generator.pushline(`}`)
          } else if (type === 'plain') {
            generator.push(`\n`)
            generator.push('export default resource')
          }
          break
        case 'ObjectExpression':
          if (propsCountStack[propsCountStack.length - 1] === 0) {
            pathStack.pop()
            propsCountStack.pop()
          }
          generator.deindent()
          generator.push(`}`)
          if (parent != null && parent.type === 'ArrayExpression') {
            if (itemsCountStack[itemsCountStack.length - 1] !== 0) {
              pathStack.pop()
              generator.pushline(`,`)
            }
          }
          break
        case 'Property':
          if (parent != null && parent.type === 'ObjectExpression') {
            if (propsCountStack[propsCountStack.length - 1] !== 0) {
              pathStack.pop()
              if (!skipStack.pop()) {
                generator.pushline(`,`)
              }
            }
          }
          break
        case 'ArrayExpression':
          if (itemsCountStack[itemsCountStack.length - 1] === 0) {
            pathStack.pop()
            itemsCountStack.pop()
          }
          generator.deindent()
          generator.push(`]`)
          if (parent != null && parent.type === 'ArrayExpression') {
            if (itemsCountStack[itemsCountStack.length - 1] !== 0) {
              pathStack.pop()
              if (!skipStack.pop()) {
                generator.pushline(`,`)
              }
            }
          }
          break
        case 'Literal':
          if (parent != null && parent.type === 'ArrayExpression') {
            if (itemsCountStack[itemsCountStack.length - 1] !== 0) {
              pathStack.pop()
            }

            if (!skipStack.pop()) {
              generator.pushline(`,`)
            }
          }
          break
        default:
          break
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
