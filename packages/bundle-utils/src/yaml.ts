/**
 * Code generator for i18n yaml resource
 */

import { isString, friendlyJSONstringify } from '@intlify/shared'
import {
  createCodeGenerator,
  generateMessageFunction,
  mapLinesColumns
} from './codegen'
import {
  parseYAML,
  traverseNodes,
  getStaticYAMLValue
} from 'yaml-eslint-parser'
import { generateLegacyCode } from './legacy'
import { RawSourceMap } from 'source-map'
import MagicString from 'magic-string'

import type { YAMLProgram, YAMLNode } from 'yaml-eslint-parser/lib/ast'
import type { CodeGenOptions, CodeGenerator, CodeGenResult } from './codegen'

/**
 * @internal
 */
export function generate(
  targetSource: string | Buffer,
  {
    type = 'plain',
    legacy = false,
    bridge = false,
    exportESM = false,
    useClassComponent = false,
    filename = 'vue-i18n-loader.yaml',
    inSourceMap = undefined,
    locale = '',
    isGlobal = false,
    sourceMap = false,
    env = 'development',
    forceStringify = false,
    onError = undefined,
    strictMessage = true,
    escapeHtml = false
  }: CodeGenOptions,
  injector?: () => string
): CodeGenResult<YAMLProgram> {
  const value = Buffer.isBuffer(targetSource)
    ? targetSource.toString()
    : targetSource

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
    strictMessage,
    escapeHtml,
    useClassComponent
  } as CodeGenOptions
  const generator = createCodeGenerator(options)

  const ast = parseYAML(value, { filePath: filename })

  // for vue 2.x
  if (legacy && type === 'sfc') {
    const gen = () => friendlyJSONstringify(getStaticYAMLValue(ast))
    const code = generateLegacyCode(options, gen)
    const s = new MagicString(code)
    return {
      ast,
      code: s.toString(),
      map: s.generateMap({
        file: filename,
        source: value,
        includeContent: true
      }) as unknown as RawSourceMap
    }
  }

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
  const pathStack = [] as string[]
  const itemsCountStack = [] as number[]
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

  const componentNamespace = '_Component'

  traverseNodes(node, {
    enterNode(node: YAMLNode, parent: YAMLNode) {
      switch (node.type) {
        case 'Program':
          if (type === 'plain') {
            generator.push(`const resource = `)
          } else if (type === 'sfc') {
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
            // prettier-ignore
            const componentVariable = bridge
              ? `Component.options || Component`
              : useClassComponent
                ? `Component.__o || Component.__vccOpts || Component.__vfdConstructor || Component`
                : `Component`
            // prettier-ignore
            generator.pushline(`const ${componentNamespace} = ${componentVariable}`)
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
            const currentCount =
              parent.entries.length - itemsCountStack[lastIndex]
            pathStack.push(currentCount.toString())
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
              name && pathStack.push(name.toString())
              const { code, map } = generateMessageFunction(
                value,
                options,
                pathStack
              )
              sourceMap && map != null && codeMaps.set(value, map)
              generator.push(`${code}`, node.value, value)
            } else {
              if (forceStringify) {
                const strValue = JSON.stringify(value)
                generator.push(`${JSON.stringify(name)}: `)
                name && pathStack.push(name.toString())
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
                name && pathStack.push(name.toString())
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
            name && pathStack.push(name.toString())
          }
          const lastIndex = propsCountStack.length - 1
          propsCountStack[lastIndex] = --propsCountStack[lastIndex]
          break
        case 'YAMLSequence':
          generator.push(`[`)
          generator.indent()
          if (parent.type === 'YAMLSequence') {
            const lastIndex = itemsCountStack.length - 1
            const currentCount =
              parent.entries.length - itemsCountStack[lastIndex]
            pathStack.push(currentCount.toString())
            itemsCountStack[lastIndex] = --itemsCountStack[lastIndex]
          }
          itemsCountStack.push(node.entries.length)
          break
        case 'YAMLScalar':
          if (parent.type === 'YAMLSequence') {
            const lastIndex = itemsCountStack.length - 1
            const currentCount =
              parent.entries.length - itemsCountStack[lastIndex]
            pathStack.push(currentCount.toString())
            if (node.type === 'YAMLScalar') {
              const value = node.value
              if (isString(value)) {
                const { code, map } = generateMessageFunction(
                  value,
                  options,
                  pathStack
                )
                sourceMap && map != null && codeMaps.set(value, map)
                generator.push(`${code}`, node, value)
              } else {
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
              }
            }
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
          } else if (type === 'plain') {
            generator.push(`\n`)
            generator.push('export default resource')
          }
          break
        case 'YAMLMapping':
          if (propsCountStack[propsCountStack.length - 1] === 0) {
            pathStack.pop()
            propsCountStack.pop()
          }
          generator.deindent()
          generator.push(`}`)
          if (parent.type === 'YAMLSequence') {
            if (itemsCountStack[itemsCountStack.length - 1] !== 0) {
              pathStack.pop()
              generator.pushline(`,`)
            }
          }
          break
        case 'YAMLPair':
          if (propsCountStack[propsCountStack.length - 1] !== 0) {
            pathStack.pop()
            generator.pushline(`,`)
          }
          break
        case 'YAMLSequence':
          if (itemsCountStack[itemsCountStack.length - 1] === 0) {
            pathStack.pop()
            itemsCountStack.pop()
          }
          generator.deindent()
          generator.push(`]`)
          if (parent.type === 'YAMLSequence') {
            if (itemsCountStack[itemsCountStack.length - 1] !== 0) {
              pathStack.pop()
              generator.pushline(`,`)
            }
          }
          break
        case 'YAMLScalar':
          if (parent.type === 'YAMLSequence') {
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
