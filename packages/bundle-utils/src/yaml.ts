/**
 * Code generator for i18n yaml resource
 */

import { isString } from '@intlify/shared'
import {
  createCodeGenerator,
  excludeLocales,
  generateMessageFunction,
  generateResourceAst,
  mapLinesColumns
} from './codegen'
import {
  parseYAML,
  traverseNodes,
  getStaticYAMLValue
} from 'yaml-eslint-parser'

import type { RawSourceMap } from 'source-map'
import type { YAMLProgram, YAMLNode } from 'yaml-eslint-parser/lib/ast'
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
    onlyLocales = [],
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
    escapeHtml = false,
    jit = false
  }: CodeGenOptions
): CodeGenResult<YAMLProgram> {
  let value = Buffer.isBuffer(targetSource)
    ? targetSource.toString()
    : targetSource

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
    useClassComponent,
    jit
  } as CodeGenOptions

  let ast = parseYAML(value, { filePath: filename })

  if (!locale && type === 'sfc' && onlyLocales?.length) {
    const messages = getStaticYAMLValue(ast) as Record<string, unknown>

    value = JSON.stringify(
      excludeLocales({
        messages,
        onlyLocales
      })
    )
    ast = parseYAML(value, { filePath: filename })
  }

  if (locale && onlyLocales?.length && !onlyLocales.includes(locale)) {
    value = JSON.stringify({})
    ast = parseYAML(value, { filePath: filename })
    options.locale = ''
    options.source = undefined
  }

  const generator = createCodeGenerator(options)
  const codeMaps = _generate(generator, ast, options)

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

function _generate(
  generator: CodeGenerator,
  node: YAMLProgram,
  options: CodeGenOptions = {}
): Map<string, RawSourceMap> {
  const propsCountStack = [] as number[]
  const pathStack = [] as string[]
  const itemsCountStack = [] as number[]
  const { forceStringify } = generator.context()
  const codeMaps = new Map<string, RawSourceMap>()
  const { type, sourceMap, isGlobal, locale, useClassComponent, jit } = options

  const codegenFn: CodeGenFunction = jit
    ? generateResourceAst
    : generateMessageFunction

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
            const exportSyntax = 'export default'
            generator.push(`${exportSyntax} function (Component) {`)
            generator.indent()
            // prettier-ignore
            const componentVariable = useClassComponent
                ? `Component.__o || Component.__vccOpts || Component`
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
              const { code, map } = codegenFn(value, options, pathStack)
              sourceMap && map != null && codeMaps.set(value, map)
              generator.push(`${code}`, node.value, value)
            } else {
              if (forceStringify) {
                const strValue = JSON.stringify(value)
                generator.push(`${JSON.stringify(name)}: `)
                name && pathStack.push(name.toString())
                const { code, map } = codegenFn(strValue, options, pathStack)
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
    leaveNode(node: YAMLNode, parent: YAMLNode) {
      switch (node.type) {
        case 'Program':
          if (type === 'sfc') {
            generator.deindent()
            generator.push(`})`)
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
