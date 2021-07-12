/**
 * Code generator for i18n json/json5 resource
 */

import { parseJSON, traverseNodes } from 'jsonc-eslint-parser'
import { isString } from '@intlify/shared'
import {
  createCodeGenerator,
  generateMessageFunction,
  mapLinesColumns
} from './codegen'
import { RawSourceMap } from 'source-map'

import type { JSONProgram, JSONNode } from 'jsonc-eslint-parser/lib/parser/ast'
import type { CodeGenOptions, CodeGenerator, CodeGenResult } from './codegen'

/**
 * @internal
 */
export function generate(
  targetSource: string | Buffer,
  {
    type = 'plain',
    filename = 'vue-i18n-loader.json',
    inSourceMap = undefined,
    locale = '',
    isGlobal = false,
    sourceMap = false,
    env = 'development',
    forceStringify = false
  }: CodeGenOptions
): CodeGenResult<JSONProgram> {
  const target = Buffer.isBuffer(targetSource)
    ? targetSource.toString()
    : targetSource
  // const value = JSON.stringify(JSON.parse(target))
  //   .replace(/\u2028/g, '\\u2028') // line separator
  //   .replace(/\u2029/g, '\\u2029') // paragraph separator
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
    forceStringify
  } as CodeGenOptions
  const generator = createCodeGenerator(options)

  const ast = parseJSON(value, { filePath: filename })
  const codeMaps = generateNode(generator, ast, options)

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
    ast,
    code,
    map: newMap != null ? newMap : undefined
  }
}

function generateNode(
  generator: CodeGenerator,
  node: JSONProgram,
  options: CodeGenOptions
): Map<string, RawSourceMap> {
  const propsCountStack = [] as number[]
  const itemsCountStack = [] as number[]
  const { forceStringify } = generator.context()
  const codeMaps = new Map<string, RawSourceMap>()
  const { type, sourceMap, isGlobal, locale } = options

  traverseNodes(node, {
    enterNode(node: JSONNode, parent: JSONNode) {
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
            generator.push(`export default function (Component) {`)
            generator.indent()
            generator.pushline(
              `Component.${variableName} = Component.${variableName} || []`
            )
            generator.push(`Component.${variableName}.push({`)
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
              const { code, map } = generateMessageFunction(value, options)
              sourceMap && map != null && codeMaps.set(value, map)
              generator.push(`${code}`, node.value, value)
            } else {
              if (forceStringify) {
                const strValue = JSON.stringify(value)
                generator.push(`${JSON.stringify(name)}: `)
                const { code, map } = generateMessageFunction(strValue, options)
                sourceMap && map != null && codeMaps.set(strValue, map)
                generator.push(`${code}`, node.value, strValue)
              } else {
                generator.push(
                  `${JSON.stringify(name)}: ${JSON.stringify(value)}`
                )
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
          }
          const lastIndex = propsCountStack.length - 1
          propsCountStack[lastIndex] = --propsCountStack[lastIndex]
          break
        case 'JSONArrayExpression':
          generator.push(`[`)
          generator.indent()
          itemsCountStack.push(node.elements.length)
          break
        case 'JSONLiteral':
          if (parent.type === 'JSONArrayExpression') {
            if (node.type === 'JSONLiteral') {
              const value = node.value
              if (isString(value)) {
                const { code, map } = generateMessageFunction(value, options)
                sourceMap && map != null && codeMaps.set(value, map)
                generator.push(`${code}`, node, value)
              } else {
                if (forceStringify) {
                  const strValue = JSON.stringify(value)
                  const { code, map } = generateMessageFunction(
                    strValue,
                    options
                  )
                  sourceMap && map != null && codeMaps.set(strValue, map)
                  generator.push(`${code}`, node, strValue)
                } else {
                  generator.push(`${JSON.stringify(value)}`)
                }
              }
            }
            const lastIndex = itemsCountStack.length - 1
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
          }
          break
        case 'JSONObjectExpression':
          if (propsCountStack[propsCountStack.length - 1] === 0) {
            propsCountStack.pop()
          }
          generator.deindent()
          generator.push(`}`)
          if (parent.type === 'JSONArrayExpression') {
            if (itemsCountStack[itemsCountStack.length - 1] !== 0) {
              generator.pushline(`,`)
            }
          }
          break
        case 'JSONProperty':
          if (propsCountStack[propsCountStack.length - 1] !== 0) {
            generator.pushline(`,`)
          }
          break
        case 'JSONArrayExpression':
          if (itemsCountStack[itemsCountStack.length - 1] === 0) {
            itemsCountStack.pop()
          }
          generator.deindent()
          generator.push(`]`)
          break
        case 'JSONLiteral':
          if (parent.type === 'JSONArrayExpression') {
            if (itemsCountStack[itemsCountStack.length - 1] !== 0) {
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
