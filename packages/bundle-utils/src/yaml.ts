/**
 * Code generator for i18n yaml resource
 */

import { isString } from '@intlify/shared'
import {
  createCodeGenerator,
  generateMessageFunction,
  mapLinesColumns
} from './codegen'
import { parseYAML, traverseNodes } from 'yaml-eslint-parser'
import { RawSourceMap } from 'source-map'

import type { YAMLProgram, YAMLNode } from 'yaml-eslint-parser/lib/ast'
import type { CodeGenOptions, CodeGenerator, CodeGenResult } from './codegen'

/**
 * @internal
 */
export function generate(
  targetSource: string | Buffer,
  {
    type = 'plain',
    bridge = false,
    useClassComponent = false,
    filename = 'vue-i18n-loader.yaml',
    inSourceMap = undefined,
    locale = '',
    isGlobal = false,
    sourceMap = false,
    env = 'development',
    forceStringify = false
  }: CodeGenOptions,
  injector?: () => string
): CodeGenResult<YAMLProgram> {
  const value = Buffer.isBuffer(targetSource)
    ? targetSource.toString()
    : targetSource

  const options = {
    type,
    bridge,
    source: value,
    sourceMap,
    locale,
    isGlobal,
    inSourceMap,
    env,
    filename,
    forceStringify,
    useClassComponent
  } as CodeGenOptions
  const generator = createCodeGenerator(options)

  const ast = parseYAML(value, { filePath: filename })
  const codeMaps = generateNode(generator, ast, options, injector)

  const { code, map } = generator.context()
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
  node: YAMLProgram,
  options: CodeGenOptions,
  injector?: () => string
): Map<string, RawSourceMap> {
  const propsCountStack = [] as number[]
  const itemsCountStack = [] as number[]
  const { forceStringify } = generator.context()
  const codeMaps = new Map<string, RawSourceMap>()
  const { type, bridge, sourceMap, isGlobal, locale, useClassComponent } =
    options

  const componentNamespace = bridge
    ? `Component.options`
    : useClassComponent
    ? `Component.__o`
    : `Component`

  traverseNodes(node, {
    enterNode(node: YAMLNode, parent: YAMLNode) {
      switch (node.type) {
        case 'Program':
          if (type === 'plain') {
            generator.push(`export default `)
          } else if (type === 'sfc') {
            const variableName =
              type === 'sfc' ? (!isGlobal ? '__i18n' : '__i18nGlobal') : ''
            const localeName =
              type === 'sfc' ? (locale != null ? locale : `""`) : ''
            const exportSyntax = bridge ? `module.exports =` : `export default`
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
        case 'YAMLMapping':
          generator.push(`{`)
          generator.indent()
          propsCountStack.push(node.pairs.length)
          if (parent.type === 'YAMLSequence') {
            const lastIndex = itemsCountStack.length - 1
            itemsCountStack[lastIndex] = --itemsCountStack[lastIndex]
          }
          break
        case 'YAMLPair':
          if (
            node.value &&
            node.value.type === 'YAMLScalar' &&
            node.key &&
            node.key.type === 'YAMLScalar'
          ) {
            const name = node.key.value
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
            node.value &&
            (node.value.type === 'YAMLMapping' ||
              node.value.type === 'YAMLSequence') &&
            node.key &&
            node.key.type === 'YAMLScalar'
          ) {
            const name = node.key.value
            generator.push(`${JSON.stringify(name)}: `)
          }
          const lastIndex = propsCountStack.length - 1
          propsCountStack[lastIndex] = --propsCountStack[lastIndex]
          break
        case 'YAMLSequence':
          generator.push(`[`)
          generator.indent()
          itemsCountStack.push(node.entries.length)
          break
        case 'YAMLScalar':
          if (parent.type === 'YAMLSequence') {
            if (node.type === 'YAMLScalar') {
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
    leaveNode(node: YAMLNode, parent: YAMLNode) {
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
            generator.push(`}`)
          }
          break
        case 'YAMLMapping':
          if (propsCountStack[propsCountStack.length - 1] === 0) {
            propsCountStack.pop()
          }
          generator.deindent()
          generator.push(`}`)
          if (parent.type === 'YAMLSequence') {
            if (itemsCountStack[itemsCountStack.length - 1] !== 0) {
              generator.pushline(`,`)
            }
          }
          break
        case 'YAMLPair':
          if (propsCountStack[propsCountStack.length - 1] !== 0) {
            generator.pushline(`,`)
          }
          break
        case 'YAMLSequence':
          if (itemsCountStack[itemsCountStack.length - 1] === 0) {
            itemsCountStack.pop()
          }
          generator.deindent()
          generator.push(`]`)
          if (parent.type === 'YAMLSequence') {
            if (itemsCountStack[itemsCountStack.length - 1] !== 0) {
              generator.pushline(`,`)
            }
          }
          break
        case 'YAMLScalar':
          if (parent.type === 'YAMLSequence') {
            if (itemsCountStack[itemsCountStack.length - 1] !== 0) {
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
