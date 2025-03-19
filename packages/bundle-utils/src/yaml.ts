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
import { parseYAML, traverseNodes, getStaticYAMLValue } from 'yaml-eslint-parser'

import type { RawSourceMap } from 'source-map'
import type { YAMLProgram, YAMLNode } from 'yaml-eslint-parser/lib/ast'
import type { CodeGenOptions, CodeGenerator, CodeGenResult, CodeGenFunction } from './codegen'

/**
 * @internal
 */
export function generate(
  targetSource: string | Buffer,
  {
    type = 'plain',
    onlyLocales = [],
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
  let value = Buffer.isBuffer(targetSource) ? targetSource.toString() : targetSource

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
    ? mapLinesColumns((map as any).toJSON(), codeMaps, inSourceMap) || null  
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
  const { type, sourceMap, isGlobal, locale, jit } = options

  const _codegenFn: CodeGenFunction = jit ? generateResourceAst : generateMessageFunction

  function codegenFn(value: string) {
    const { code, map } = _codegenFn(value, options, pathStack)
    sourceMap && map != null && codeMaps.set(value, map)
    return code
  }

  const componentNamespace = '_Component'

  traverseNodes(node, {
    enterNode(node: YAMLNode, parent: YAMLNode) {
      if (parent?.type === 'YAMLSequence') {
        const lastIndex = itemsCountStack.length - 1
        const currentCount = parent.entries.length - itemsCountStack[lastIndex]
        pathStack.push(currentCount.toString())
        itemsCountStack[lastIndex] = --itemsCountStack[lastIndex]
      } else if (parent?.type === 'YAMLMapping') {
        const lastIndex = propsCountStack.length - 1
        propsCountStack[lastIndex] = --propsCountStack[lastIndex]
      }

      switch (node.type) {
        case 'Program':
          if (type === 'plain') {
            generator.push(`const resource = `)
          } else if (type === 'sfc') {
            const variableName = !isGlobal ? '__i18n' : '__i18nGlobal'
            const localeName = JSON.stringify(locale ?? `""`)
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
        case 'YAMLMapping':
          generator.push(`{`)
          generator.indent()
          propsCountStack.push(node.pairs.length)
          break
        case 'YAMLSequence':
          generator.push(`[`)
          generator.indent()
          itemsCountStack.push(node.entries.length)
          break
        case 'YAMLPair':
          if (node.key?.type !== 'YAMLScalar') break
          if (node.value?.type === 'YAMLScalar') {
            const name = node.key.value
            const value = node.value.value
            const strName = JSON.stringify(name)
            const strValue = JSON.stringify(value)
            name && pathStack.push(name.toString())
            generator.push(`${strName}: `)
            if (isString(value)) {
              generator.push(codegenFn(value), node.value, value)
            } else if (forceStringify) {
              generator.push(codegenFn(strValue), node.value, strValue)
            } else {
              generator.push(strValue)
            }
          } else if (node.value?.type === 'YAMLMapping' || node.value?.type === 'YAMLSequence') {
            const name = node.key.value
            name && pathStack.push(name.toString())
            generator.push(`${JSON.stringify(name)}: `)
          }
          break
        case 'YAMLScalar':
          if (parent.type === 'YAMLSequence') {
            const value = node.value
            const strValue = JSON.stringify(value)
            if (isString(value)) {
              generator.push(codegenFn(value), node, value)
            } else if (forceStringify) {
              generator.push(codegenFn(strValue), node, strValue)
            } else {
              generator.push(strValue)
            }
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
          break
        case 'YAMLSequence':
          if (itemsCountStack[itemsCountStack.length - 1] === 0) {
            pathStack.pop()
            itemsCountStack.pop()
          }
          generator.deindent()
          generator.push(`]`)
          break
        default:
          break
      }

      // if not last obj property or array value
      const stackArr = node.type === 'YAMLPair' ? propsCountStack : itemsCountStack
      if (parent?.type === 'YAMLSequence' || parent?.type === 'YAMLMapping') {
        if (stackArr[stackArr.length - 1] !== 0) {
          pathStack.pop()
          generator.pushline(`,`)
        } else if (node.type === 'YAMLScalar') {
          generator.pushline(`,`)
        }
      }
    }
  })

  return codeMaps
}
