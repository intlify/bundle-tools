/**
 * Code / AST generator for i18n json/json5 resource
 */

import {
  parseJSON,
  traverseNodes,
  getStaticJSONValue
} from 'jsonc-eslint-parser'
import { isString } from '@intlify/shared'
import {
  createCodeGenerator,
  generateMessageFunction,
  generateResourceAst,
  mapLinesColumns,
  excludeLocales
} from './codegen'

import type { RawSourceMap } from 'source-map-js'
import type { JSONProgram, JSONNode } from 'jsonc-eslint-parser/lib/parser/ast'
import type {
  CodeGenOptions,
  CodeGenerator,
  CodeGenResult,
  CodeGenFunction
} from './codegen'

export function generate(
  targetSource: string | Buffer,
  {
    type = 'plain',
    onlyLocales = [],
    filename = 'vue-i18n-loader.json',
    inSourceMap = undefined,
    locale = '',
    isGlobal = false,
    sourceMap = false,
    env = 'development',
    forceStringify = false,
    onError = undefined,
    strictMessage = true,
    escapeHtml = false,
    jit = false,
    transformI18nBlock = undefined
  }: CodeGenOptions
): CodeGenResult<JSONProgram> {
  let value = Buffer.isBuffer(targetSource)
    ? targetSource.toString()
    : targetSource
  // const value = JSON.stringify(JSON.parse(target))
  //   .replace(/\u2028/g, '\\u2028') // line separator
  //   .replace(/\u2029/g, '\\u2029') // paragraph separator

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
    jit,
    transformI18nBlock
  } as CodeGenOptions

  if (transformI18nBlock) {
    transformI18nBlock(value)
  }
  let ast = parseJSON(value, { filePath: filename })

  if (!locale && type === 'sfc' && onlyLocales?.length) {
    const messages = getStaticJSONValue(ast) as Record<string, unknown>

    value = JSON.stringify(
      excludeLocales({
        messages,
        onlyLocales
      })
    )
    ast = parseJSON(value, { filePath: filename })
  }

  if (locale && onlyLocales?.length && !onlyLocales.includes(locale)) {
    value = JSON.stringify({})
    ast = parseJSON(value, { filePath: filename })
    options.locale = ''
    options.source = undefined
  }

  const generator = createCodeGenerator(options)
  const codeMaps = _generate(generator, ast, options)

  const { code, map } = generator.context()
  // if (map) {
  //   const s = new SourceMapConsumer((map as any).toJSON())
  //   s.eachMapping(m => {
  //     console.log('sourcemap json', m)
  //   })
  // }
  // prettier-ignore
  const newMap =
    map && !jit
      ? mapLinesColumns((map as any).toJSON(), codeMaps, inSourceMap) || null // eslint-disable-line @typescript-eslint/no-explicit-any
      : null
  return {
    ast,
    code,
    map: newMap != null ? newMap : undefined
  }
}

function _generate(
  generator: CodeGenerator,
  node: JSONProgram,
  options: CodeGenOptions = {}
): Map<string, RawSourceMap> {
  const propsCountStack = [] as number[]
  const pathStack = [] as string[]
  const itemsCountStack = [] as number[]
  const { forceStringify } = generator.context()
  const codeMaps = new Map<string, RawSourceMap>()
  const { type, sourceMap, isGlobal, locale, jit } = options

  const codegenFn: CodeGenFunction = jit
    ? generateResourceAst
    : generateMessageFunction

  const componentNamespace = '_Component'

  traverseNodes(node, {
    enterNode(node: JSONNode, parent: JSONNode) {
      switch (node.type) {
        case 'Program':
          if (type === 'plain') {
            generator.push(`const resource = `)
          } else if (type === 'sfc') {
            // for 'sfc'
            const variableName =
              type === 'sfc' ? (!isGlobal ? '__i18n' : '__i18nGlobal') : ''
            const localeName =
              type === 'sfc' ? (locale != null ? locale : `""`) : ''
            const exportSyntax = 'export default'
            generator.push(`${exportSyntax} function (Component) {`)
            generator.indent()
            const componentVariable = `Component`
            generator.pushline(
              `const ${componentNamespace} = ${componentVariable}`
            )
            generator.pushline(
              `${componentNamespace}.${variableName} = ${componentNamespace}.${variableName} || []`
            )
            generator.push(`${componentNamespace}.${variableName}.push({`)
            generator.indent()
            generator.pushline(`"locale": ${JSON.stringify(localeName)},`)
            generator.push(`"resource": `)
          }
          break
        case 'JSONObjectExpression':
          generator.push(`{`)
          generator.indent()
          propsCountStack.push(node.properties.length)
          if (parent.type === 'JSONArrayExpression') {
            const lastIndex = itemsCountStack.length - 1
            const currentCount =
              parent.elements.length - itemsCountStack[lastIndex]
            pathStack.push(currentCount.toString())
            itemsCountStack[lastIndex] = --itemsCountStack[lastIndex]
          }
          break
        case 'JSONProperty':
          if (
            node.value.type === 'JSONLiteral' &&
            (node.key.type === 'JSONLiteral' ||
              node.key.type === 'JSONIdentifier')
          ) {
            const name =
              node.key.type === 'JSONLiteral' ? node.key.value : node.key.name
            const value = node.value.value
            if (isString(value)) {
              generator.push(`${JSON.stringify(name)}: `)
              pathStack.push(name.toString())
              const { code, map } = codegenFn(value, options, pathStack)
              sourceMap && map != null && codeMaps.set(value, map)
              generator.push(`${code}`, node.value, value)
            } else {
              if (forceStringify) {
                const strValue = JSON.stringify(value)
                generator.push(`${JSON.stringify(name)}: `)
                pathStack.push(name.toString())
                const { code, map } = codegenFn(strValue, options, pathStack)
                sourceMap && map != null && codeMaps.set(strValue, map)
                generator.push(`${code}`, node.value, strValue)
              } else {
                generator.push(
                  `${JSON.stringify(name)}: ${JSON.stringify(value)}`
                )
                pathStack.push(name.toString())
              }
            }
          } else if (
            (node.value.type === 'JSONObjectExpression' ||
              node.value.type === 'JSONArrayExpression') &&
            (node.key.type === 'JSONLiteral' ||
              node.key.type === 'JSONIdentifier')
          ) {
            const name =
              node.key.type === 'JSONLiteral' ? node.key.value : node.key.name
            generator.push(`${JSON.stringify(name)}: `)
            pathStack.push(name.toString())
          }
          const lastIndex = propsCountStack.length - 1
          propsCountStack[lastIndex] = --propsCountStack[lastIndex]
          break
        case 'JSONArrayExpression':
          generator.push(`[`)
          generator.indent()
          if (parent.type === 'JSONArrayExpression') {
            const lastIndex = itemsCountStack.length - 1
            const currentCount =
              parent.elements.length - itemsCountStack[lastIndex]
            pathStack.push(currentCount.toString())
            itemsCountStack[lastIndex] = --itemsCountStack[lastIndex]
          }
          itemsCountStack.push(node.elements.length)
          break
        case 'JSONLiteral':
          if (parent.type === 'JSONArrayExpression') {
            const lastIndex = itemsCountStack.length - 1
            const currentCount =
              parent.elements.length - itemsCountStack[lastIndex]
            pathStack.push(currentCount.toString())
            if (node.type === 'JSONLiteral') {
              const value = node.value
              if (isString(value)) {
                const { code, map } = codegenFn(value, options, pathStack)
                sourceMap && map != null && codeMaps.set(value, map)
                generator.push(`${code}`, node, value)
              } else {
                if (forceStringify) {
                  const strValue = JSON.stringify(value)
                  const { code, map } = codegenFn(strValue, options, pathStack)
                  sourceMap && map != null && codeMaps.set(strValue, map)
                  generator.push(`${code}`, node, strValue)
                } else {
                  generator.push(`${JSON.stringify(value)}`)
                }
              }
            }
            itemsCountStack[lastIndex] = --itemsCountStack[lastIndex]
          }
          break
        default:
          break
      }
    },
    leaveNode(node: JSONNode, parent: JSONNode) {
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
        case 'JSONObjectExpression':
          if (propsCountStack[propsCountStack.length - 1] === 0) {
            pathStack.pop()
            propsCountStack.pop()
          }
          generator.deindent()
          generator.push(`}`)
          if (parent.type === 'JSONArrayExpression') {
            if (itemsCountStack[itemsCountStack.length - 1] !== 0) {
              pathStack.pop()
              generator.pushline(`,`)
            }
          }
          break
        case 'JSONProperty':
          if (propsCountStack[propsCountStack.length - 1] !== 0) {
            pathStack.pop()
            generator.pushline(`,`)
          }
          break
        case 'JSONArrayExpression':
          if (itemsCountStack[itemsCountStack.length - 1] === 0) {
            pathStack.pop()
            itemsCountStack.pop()
          }
          generator.deindent()
          generator.push(`]`)
          if (parent.type === 'JSONArrayExpression') {
            if (itemsCountStack[itemsCountStack.length - 1] !== 0) {
              pathStack.pop()
              generator.pushline(`,`)
            }
          }
          break
        case 'JSONLiteral':
          if (parent.type === 'JSONArrayExpression') {
            if (itemsCountStack[itemsCountStack.length - 1] !== 0) {
              pathStack.pop()
              generator.pushline(`,`)
            } else {
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
