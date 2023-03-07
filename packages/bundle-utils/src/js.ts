/**
 * Code generator for i18n js resource
 */

import { parse as parseJavaScript, ParseResult } from '@babel/parser'
import { default as traverseNodes } from '@babel/traverse'
import {
  createCodeGenerator,
  generateMessageFunction,
  mapLinesColumns
} from './codegen'
import { RawSourceMap } from 'source-map'

import type {
  File,
  Node,
  BooleanLiteral,
  NullLiteral,
  NumericLiteral,
  StringLiteral,
  TemplateLiteral
} from '@babel/types'
import type { NodePath } from '@babel/traverse'
import type { CodeGenOptions, CodeGenerator, CodeGenResult } from './codegen'

/**
 * @internal
 */
export function generate(
  targetSource: string | Buffer,
  {
    type = 'plain',
    bridge = false,
    exportESM = false,
    filename = 'vue-i18n-loader.js',
    inSourceMap = undefined,
    locale = '',
    isGlobal = false,
    sourceMap = false,
    env = 'development',
    forceStringify = false,
    onError = undefined,
    useClassComponent = false
  }: CodeGenOptions,
  injector?: () => string
): CodeGenResult<ParseResult<File>> {
  const target = Buffer.isBuffer(targetSource)
    ? targetSource.toString()
    : targetSource
  const value = target

  const options = {
    type,
    bridge,
    exportESM,
    source: value,
    sourceMap,
    locale,
    isGlobal,
    inSourceMap,
    env,
    filename,
    forceStringify,
    onError,
    useClassComponent
  } as CodeGenOptions
  const generator = createCodeGenerator(options)

  const ast = parseJavaScript(value, {
    sourceType: 'module',
    sourceFilename: filename,
    allowImportExportEverywhere: true
  })

  if (ast.errors) {
    // TODO:
  }

  const codeMaps = generateNode(generator, ast as File, options, injector)

  const { code, map } = generator.context()
  // if (map) {
  //   const s = new SourceMapConsumer((map as any).toJSON())
  //   s.eachMapping(m => {
  //     console.log('sourcemap json', m)
  //   })
  // }
  // prettier-ignore
  const newMap = map
    ? mapLinesColumns((map as any).toJSON(), codeMaps, inSourceMap) || null // eslint-disable-line @typescript-eslint/no-explicit-any
    : null
  return {
    ast: ast as ParseResult<File>,
    code,
    map: newMap != null ? newMap : undefined
  }
}

function generateNode(
  generator: CodeGenerator,
  node: File,
  options: CodeGenOptions,
  injector?: () => string
): Map<string, RawSourceMap> {
  const propsCountStack = [] as number[]
  const pathStack = [] as string[]
  const itemsCountStack = [] as number[]
  const skipStack = [] as boolean[]
  const { forceStringify } = generator.context()
  const codeMaps = new Map<string, RawSourceMap>()
  const {
    type,
    bridge,
    exportESM,
    sourceMap,
    isGlobal,
    locale,
    useClassComponent
  } = options

  // prettier-ignore
  const componentNamespace = bridge
    ? `Component.options`
    : useClassComponent
      ? `Component.__o`
      : `Component`

  // @ts-ignore TODO: `tranverse` first argument type should be fixed
  traverseNodes(node as Node, {
    enter({ node, parent }: NodePath<Node>) {
      switch (node.type) {
        case 'Program':
          if (type === 'plain') {
            generator.push(`export default `)
          } else if (type === 'sfc') {
            // for 'sfc'
            const variableName =
              type === 'sfc' ? (!isGlobal ? '__i18n' : '__i18nGlobal') : ''
            const localeName =
              type === 'sfc' ? (locale != null ? locale : `""`) : ''
            const exportSyntax = bridge
              ? exportESM
                ? `export default`
                : `module.exports =`
              : `export default`
            generator.push(`${exportSyntax} function (Component) {`)
            generator.indent()
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
          if (parent.type === 'ArrayExpression') {
            const lastIndex = itemsCountStack.length - 1
            const currentCount =
              parent.elements.length - itemsCountStack[lastIndex]
            pathStack.push(currentCount.toString())
            itemsCountStack[lastIndex] = --itemsCountStack[lastIndex]
          }
          break
        case 'ObjectProperty':
          if (
            isJSONablePrimitiveLiteral(node.value) &&
            (node.key.type === 'StringLiteral' ||
              node.key.type === 'Identifier')
          ) {
            // prettier-ignore
            const name = node.key.type === 'StringLiteral'
              ? node.key.value
              : node.key.name
            if (
              node.value.type === 'StringLiteral' ||
              node.value.type === 'TemplateLiteral'
            ) {
              const value = getValue(node.value) as string
              generator.push(`${JSON.stringify(name)}: `)
              pathStack.push(name)
              const { code, map } = generateMessageFunction(
                value,
                options,
                pathStack
              )
              sourceMap && map != null && codeMaps.set(value, map)
              generator.push(`${code}`, node.value, value)
              skipStack.push(false)
            } else {
              const value = getValue(node.value)
              if (forceStringify) {
                const strValue = JSON.stringify(value)
                generator.push(`${JSON.stringify(name)}: `)
                pathStack.push(name)
                const { code, map } = generateMessageFunction(
                  strValue,
                  options,
                  pathStack
                )
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
            (node.value.type === 'ObjectExpression' ||
              node.value.type === 'ArrayExpression') &&
            (node.key.type === 'StringLiteral' ||
              node.key.type === 'Identifier')
          ) {
            // prettier-ignore
            const name = node.key.type === 'StringLiteral'
              ? node.key.value
              : node.key.name
            generator.push(`${JSON.stringify(name)}: `)
            pathStack.push(name)
          } else {
            // for Regex, function, etc.
            skipStack.push(true)
          }
          const lastIndex = propsCountStack.length - 1
          propsCountStack[lastIndex] = --propsCountStack[lastIndex]
          break
        case 'ArrayExpression':
          generator.push(`[`)
          generator.indent()
          if (parent.type === 'ArrayExpression') {
            const lastIndex = itemsCountStack.length - 1
            const currentCount =
              parent.elements.length - itemsCountStack[lastIndex]
            pathStack.push(currentCount.toString())
            itemsCountStack[lastIndex] = --itemsCountStack[lastIndex]
          }
          itemsCountStack.push(node.elements.length)
          break
        default:
          if (isJSONablePrimitiveLiteral(node)) {
            if (parent.type === 'ArrayExpression') {
              const lastIndex = itemsCountStack.length - 1
              const currentCount =
                parent.elements.length - itemsCountStack[lastIndex]
              pathStack.push(currentCount.toString())
              if (
                node.type === 'StringLiteral' ||
                node.type === 'TemplateLiteral'
              ) {
                const value = getValue(node) as string
                const { code, map } = generateMessageFunction(
                  value,
                  options,
                  pathStack
                )
                sourceMap && map != null && codeMaps.set(value, map)
                generator.push(`${code}`, node, value)
                skipStack.push(false)
              } else {
                const value = getValue(node)
                if (forceStringify) {
                  const strValue = JSON.stringify(value)
                  const { code, map } = generateMessageFunction(
                    strValue,
                    options,
                    pathStack
                  )
                  sourceMap && map != null && codeMaps.set(strValue, map)
                  generator.push(`${code}`, node, strValue)
                } else {
                  generator.push(`${JSON.stringify(value)}`)
                }
                skipStack.push(false)
              }
              itemsCountStack[lastIndex] = --itemsCountStack[lastIndex]
            }
          } else {
            // ...
          }
          break
      }
    },
    exit({ node, parent }: NodePath<Node>) {
      switch (node.type) {
        case 'Program':
          if (type === 'sfc') {
            generator.deindent()
            generator.push(`})`)
            if (bridge && injector) {
              generator.newline()
              generator.pushline(
                `${componentNamespace}.__i18nBridge = ${componentNamespace}.__i18nBridge || []`
              )
              generator.pushline(
                `${componentNamespace}.__i18nBridge.push('${injector()}')`
              )
              generator.pushline(`delete ${componentNamespace}._Ctor`)
            }
            generator.deindent()
            generator.pushline(`}`)
          }
          break
        case 'ObjectExpression':
          if (propsCountStack[propsCountStack.length - 1] === 0) {
            pathStack.pop()
            propsCountStack.pop()
          }
          generator.deindent()
          generator.push(`}`)
          if (parent.type === 'ArrayExpression') {
            if (itemsCountStack[itemsCountStack.length - 1] !== 0) {
              pathStack.pop()
              generator.pushline(`,`)
            }
          }
          break
        case 'ObjectProperty':
          if (propsCountStack[propsCountStack.length - 1] !== 0) {
            pathStack.pop()
            if (!skipStack.pop()) {
              generator.pushline(`,`)
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
          if (parent.type === 'ArrayExpression') {
            if (itemsCountStack[itemsCountStack.length - 1] !== 0) {
              pathStack.pop()
              if (!skipStack.pop()) {
                generator.pushline(`,`)
              }
            }
          }
          break
        default:
          if (isJSONablePrimitiveLiteral(node)) {
            if (parent.type === 'ArrayExpression') {
              if (itemsCountStack[itemsCountStack.length - 1] !== 0) {
                pathStack.pop()
                if (!skipStack.pop()) {
                  generator.pushline(`,`)
                }
              } else {
                if (!skipStack.pop()) {
                  generator.pushline(`,`)
                }
              }
            }
          } else {
            // ...
          }
          break
      }
    }
  })

  return codeMaps
}

type JSONablePrimitiveLiteral =
  | NullLiteral
  | BooleanLiteral
  | NumericLiteral
  | StringLiteral
  | TemplateLiteral

function isJSONablePrimitiveLiteral(
  node: Node
): node is JSONablePrimitiveLiteral {
  return (
    node.type === 'NullLiteral' ||
    node.type === 'BooleanLiteral' ||
    node.type === 'NumericLiteral' ||
    node.type === 'StringLiteral' ||
    node.type === 'TemplateLiteral'
  )
}

function getValue(node: JSONablePrimitiveLiteral) {
  // prettier-ignore
  return node.type === 'StringLiteral'
    ? node.value
    : node.type === 'NullLiteral'
      ? null
      : node.type === 'TemplateLiteral'
        ? node.quasis.map(quasi => quasi.value.cooked).join('')
        : node.value
}
