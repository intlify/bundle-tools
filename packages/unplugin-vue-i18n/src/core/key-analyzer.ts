import type { UsedKeysCollector } from './collector'

// i18n function names to detect
const I18N_FUNCTIONS = new Set(['t', '$t', 'tc', '$tc', 'te', '$te', 'd', '$d', 'n', '$n'])

// Regex patterns for template analysis
const TEMPLATE_T_REGEX = /\$?t\s*\(\s*['"]([^'"]+)['"]/g
const VT_DIRECTIVE_STRING_REGEX = /v-t\s*=\s*"'([^']+)'"/g
const VT_DIRECTIVE_PATH_REGEX = /v-t\s*=\s*"\{[^}]*path\s*:\s*'([^']+)'/g
// Detect dynamic key usage: $t(variable), t(expr) — argument starts with identifier char, not a quote
const TEMPLATE_DYNAMIC_T_REGEX = /\$?t\s*\(\s*[a-zA-Z_$]/g

export interface KeyExtractionResult {
  keys: string[]
  hasDynamic: boolean
}

/**
 * Extract i18n keys from script source using AST analysis.
 * Uses @typescript-eslint/typescript-estree (same dependency as directive.ts).
 */
export async function extractKeysFromScript(source: string): Promise<KeyExtractionResult> {
  const keys: string[] = []
  let hasDynamic = false

  let tsEstree: typeof import('@typescript-eslint/typescript-estree')
  try {
    tsEstree = await import('@typescript-eslint/typescript-estree')
  } catch {
    // If typescript-estree is not available, fall back to regex
    return extractKeysFromScriptRegex(source)
  }

  try {
    const ast = tsEstree.parse(source, {
      range: true,
      jsx: true,
      allowInvalidAST: true,
      suppressDeprecatedPropertyWarnings: true
    })

    tsEstree.simpleTraverse(ast, {
      enter(node) {
        if (node.type !== tsEstree.AST_NODE_TYPES.CallExpression) {
          return
        }

        const calleeName = getCalleeName(node, tsEstree.AST_NODE_TYPES)
        if (!calleeName || !I18N_FUNCTIONS.has(calleeName)) {
          return
        }

        const firstArg = node.arguments[0]
        if (!firstArg) {
          return
        }

        if (
          firstArg.type === tsEstree.AST_NODE_TYPES.Literal &&
          typeof firstArg.value === 'string'
        ) {
          keys.push(firstArg.value)
        } else if (
          firstArg.type === tsEstree.AST_NODE_TYPES.TemplateLiteral &&
          firstArg.expressions.length === 0 &&
          firstArg.quasis.length === 1
        ) {
          const value = firstArg.quasis[0].value.cooked
          if (value) {
            keys.push(value)
          }
        } else {
          hasDynamic = true
        }
      }
    })
  } catch {
    // Parse error, fall back to regex
    return extractKeysFromScriptRegex(source)
  }

  return { keys, hasDynamic }
}

function getCalleeName(
  node: { callee: any },
  AST_NODE_TYPES: typeof import('@typescript-eslint/typescript-estree').AST_NODE_TYPES
): string | null {
  const callee = node.callee

  // Direct call: t('key')
  if (callee.type === AST_NODE_TYPES.Identifier) {
    return callee.name
  }

  // Member expression: i18n.t('key'), this.$t('key')
  if (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    callee.property.type === AST_NODE_TYPES.Identifier
  ) {
    return callee.property.name
  }

  return null
}

/**
 * Fallback: extract i18n keys from script using regex.
 */
function extractKeysFromScriptRegex(source: string): KeyExtractionResult {
  const keys: string[] = []
  let match: RegExpExecArray | null

  const regex = /\b(?:\$?t|tc|\$tc|te|\$te|d|\$d|n|\$n)\s*\(\s*['"]([^'"]+)['"]/g
  while ((match = regex.exec(source)) !== null) {
    keys.push(match[1])
  }

  return { keys, hasDynamic: false }
}

/**
 * Extract i18n keys from Vue template content using regex.
 */
export function extractKeysFromTemplate(templateContent: string): KeyExtractionResult {
  const keys: string[] = []
  let hasDynamic = false
  let match: RegExpExecArray | null

  // Reset lastIndex for all regexes
  TEMPLATE_T_REGEX.lastIndex = 0
  VT_DIRECTIVE_STRING_REGEX.lastIndex = 0
  VT_DIRECTIVE_PATH_REGEX.lastIndex = 0
  TEMPLATE_DYNAMIC_T_REGEX.lastIndex = 0

  // $t('key') / t('key')
  while ((match = TEMPLATE_T_REGEX.exec(templateContent)) !== null) {
    keys.push(match[1])
  }

  // v-t="'key'"
  while ((match = VT_DIRECTIVE_STRING_REGEX.exec(templateContent)) !== null) {
    keys.push(match[1])
  }

  // v-t="{path: 'key'}"
  while ((match = VT_DIRECTIVE_PATH_REGEX.exec(templateContent)) !== null) {
    keys.push(match[1])
  }

  // Detect dynamic key usage: $t(variable), t(expr)
  if (TEMPLATE_DYNAMIC_T_REGEX.test(templateContent)) {
    hasDynamic = true
  }

  return { keys, hasDynamic }
}

/**
 * Analyze a Vue SFC file and extract all used i18n keys.
 */
export async function analyzeVueSFC(content: string): Promise<KeyExtractionResult> {
  const keys: string[] = []
  let hasDynamic = false

  let parse: typeof import('vue/compiler-sfc').parse
  try {
    const compilerSfc = await import('vue/compiler-sfc')
    parse = compilerSfc.parse
  } catch {
    // If vue/compiler-sfc is not available, fall back to regex on entire content
    const templateResult = extractKeysFromTemplate(content)
    const scriptResult = await extractKeysFromScript(content)
    return {
      keys: [...templateResult.keys, ...scriptResult.keys],
      hasDynamic: templateResult.hasDynamic || scriptResult.hasDynamic
    }
  }

  const { descriptor } = parse(content)

  // Analyze template
  if (descriptor.template?.content) {
    const templateResult = extractKeysFromTemplate(descriptor.template.content)
    keys.push(...templateResult.keys)
    if (templateResult.hasDynamic) {
      hasDynamic = true
    }
  }

  // Analyze script / scriptSetup
  const scriptContent = descriptor.scriptSetup?.content || descriptor.script?.content
  if (scriptContent) {
    const scriptResult = await extractKeysFromScript(scriptContent)
    keys.push(...scriptResult.keys)
    if (scriptResult.hasDynamic) {
      hasDynamic = true
    }
  }

  return { keys, hasDynamic }
}

/**
 * Analyze a source file (.vue, .ts, .js) and add used keys to the collector.
 */
export async function analyzeFile(
  content: string,
  filePath: string,
  collector: UsedKeysCollector
): Promise<void> {
  let result: KeyExtractionResult

  if (filePath.endsWith('.vue')) {
    result = await analyzeVueSFC(content)
  } else {
    result = await extractKeysFromScript(content)
  }

  for (const key of result.keys) {
    collector.addKey(key)
  }

  if (result.hasDynamic) {
    collector.markDynamic()
  }
}
