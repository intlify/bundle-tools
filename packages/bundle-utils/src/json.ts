/**
 * Code / AST generator for i18n json/json5 resource
 */

import { isString } from '@intlify/shared'
import {
  getStaticJSONValue,
  parseJSON,
  traverseNodes
} from 'jsonc-eslint-parser'
import {
  createCodeGenerator,
  excludeLocales,
  generateMessageFunction,
  generateResourceAst,
  mapLinesColumns
} from './codegen'

import type { JSONNode, JSONProgram } from 'jsonc-eslint-parser/lib/parser/ast'
import type { RawSourceMap } from 'source-map-js'
import type {
  CodeGenerator,
  CodeGenFunction,
  CodeGenOptions,
  CodeGenResult
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
    jit = false
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
    jit
  } as CodeGenOptions

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
  node: JSONProgram,
  options: CodeGenOptions = {}
): Map<string, RawSourceMap> {
  const propsCountStack = [] as number[]
  const pathStack = [] as string[]
  const itemsCountStack = [] as number[]
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

  traverseNodes(node, {
    enterNode(node: JSONNode, parent: JSONNode) {
      if (parent?.type === 'JSONArrayExpression') {
        const lastIndex = itemsCountStack.length - 1
        const currentCount = parent.elements.length - itemsCountStack[lastIndex]
        pathStack.push(currentCount.toString())
        itemsCountStack[lastIndex] = --itemsCountStack[lastIndex]
      } else if (parent?.type === 'JSONObjectExpression') {
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
        case 'JSONObjectExpression':
          generator.push(`{`)
          generator.indent()
          propsCountStack.push(node.properties.length)
          break
        case 'JSONArrayExpression':
          generator.push(`[`)
          generator.indent()
          itemsCountStack.push(node.elements.length)
          break
        case 'JSONProperty': {
          const name =
            node.key.type === 'JSONLiteral' ? node.key.value : node.key.name
          const strName = JSON.stringify(name)
          generator.push(`${strName}: `)
          pathStack.push(name.toString())
          if (node.value.type === 'JSONLiteral') {
            const value = node.value.value
            const strValue = JSON.stringify(value)
            if (isString(value)) {
              generator.push(codegenFn(value), node.value, value)
            } else if (forceStringify) {
              generator.push(codegenFn(strValue), node.value, strValue)
            } else {
              generator.push(strValue)
            }
          }
          break
        }
        case 'JSONLiteral':
          if (parent.type !== 'JSONArrayExpression') break
          const value = node.value
          const strValue = JSON.stringify(value)
          if (isString(value)) {
            generator.push(codegenFn(value), node, value)
          } else if (forceStringify) {
            generator.push(codegenFn(strValue), node, strValue)
          } else {
            generator.push(strValue)
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
          break
        case 'JSONArrayExpression':
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
      if (
        parent?.type === 'JSONArrayExpression' ||
        parent?.type === 'JSONObjectExpression'
      ) {
        const stackArr =
          node.type === 'JSONProperty' ? propsCountStack : itemsCountStack
        if (stackArr[stackArr.length - 1] !== 0) {
          pathStack.pop()
          generator.pushline(`,`)
        }
      }
    }
  })

  return codeMaps
}
