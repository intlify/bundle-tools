/**
 * This code is adapted from the composable keys transformation in Nuxt:
 * - original code url: https://github.com/nuxt/nuxt/blob/a80d1a0d6349bf1003666fc79a513c0d7370c931/packages/vite/src/plugins/composable-keys.ts
 * - author: Nuxt Framework Team
 * - license: MIT
 */

import { parse as parseSFC } from '@vue/compiler-sfc'
import createDebug from 'debug'
import type { CallExpression, Pattern, Program } from 'estree'
import { walk } from 'estree-walker'
import MagicString from 'magic-string'
import { pathToFileURL } from 'node:url'
import { parseQuery, parseURL } from 'ufo'
import { UnpluginOptions } from 'unplugin'
import { resolveNamespace } from '../utils'
const debug = createDebug(resolveNamespace('auto-declare'))

const TRANSLATION_FUNCTIONS = ['$t', '$rt', '$d', '$n', '$tm', '$te']
const TRANSLATION_FUNCTIONS_RE = /\$(t|rt|d|n|tm|te)\s*\(\s*/
const TRANSLATION_FUNCTIONS_MAP: Record<(typeof TRANSLATION_FUNCTIONS)[number], string> = {
  $t: 't: $t',
  $rt: 'rt: $rt',
  $d: 'd: $d',
  $n: 'n: $n',
  $tm: 'tm: $tm',
  $te: 'te: $te'
}

// from https://github.com/nuxt/nuxt/blob/a80d1a0d6349bf1003666fc79a513c0d7370c931/packages/nuxt/src/core/utils/plugins.ts#L4-L35
function isVue(id: string, opts: { type?: Array<'template' | 'script' | 'style'> } = {}) {
  // Bare `.vue` file (in Vite)
  const { search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
  if (id.endsWith('.vue') && !search) {
    return true
  }

  if (!search) {
    return false
  }

  const query = parseQuery(search)

  // Component async/lazy wrapper
  if (query.nuxt_component) {
    return false
  }

  // Macro
  if (query.macro && (search === '?macro=true' || !opts.type || opts.type.includes('script'))) {
    return true
  }

  // Non-Vue or Styles
  const type = 'setup' in query ? 'script' : (query.type as 'script' | 'template' | 'style')
  if (!('vue' in query) || (opts.type && !opts.type.includes(type))) {
    return false
  }

  // Query `?vue&type=template` (in Webpack or external template)
  return true
}

export function autoDeclarePlugin(options: { sourcemap: boolean }): UnpluginOptions {
  return {
    name: resolveNamespace('auto-declare'),
    enforce: 'pre',

    transformInclude(id) {
      return isVue(id, { type: ['script'] })
    },

    transform(code, id) {
      debug('transform', id)

      // only transform if translation functions are present
      const script = extractScriptContent(code)
      if (!script || !TRANSLATION_FUNCTIONS_RE.test(script)) {
        return
      }

      // only transform <script setup> and if translation functions are present
      const scriptSetup = parseSFC(code, { sourceMap: false }).descriptor.scriptSetup
      if (!scriptSetup) {
        return
      }

      // strip types and typescript specific features for ast parsing
      // const ast = parseSync(id, script, { lang: 'tsx' })
      const ast = this.parse(script, {
        // ecmaVersion: 'latest',
        sourceType: 'module',
        sourceFile: id,
        allowImportExportEverywhere: true
      })
      console.log(ast)

      // collect variable and function declarations with scope info.
      let scopeTracker = new ScopeTracker()
      const varCollector = new ScopedVarsCollector()
      walk(ast, {
        enter(_node) {
          if (_node.type === 'BlockStatement') {
            scopeTracker.enterScope()
            varCollector.refresh(scopeTracker.curScopeKey)
            // @ts-expect-error type mismatch
          } else if (_node.type === 'FunctionDeclaration' && _node.id) {
            // @ts-expect-error type mismatch
            varCollector.addVar(_node.id.name)
          } else if (_node.type === 'VariableDeclarator') {
            // @ts-expect-error type mismatch
            varCollector.collect(_node.id)
          }
        },
        leave(_node) {
          if (_node.type === 'BlockStatement') {
            scopeTracker.leaveScope()
            varCollector.refresh(scopeTracker.curScopeKey)
          }
        }
      })

      const missingFunctionDeclarators = new Set<string>()
      scopeTracker = new ScopeTracker()
      walk(ast as unknown as Program, {
        enter(_node) {
          if (_node.type === 'BlockStatement') {
            scopeTracker.enterScope()
          }

          if (
            _node.type !== 'CallExpression' ||
            (_node as CallExpression).callee.type !== 'Identifier'
          ) {
            return
          }

          const node: CallExpression = _node as CallExpression
          const name = 'name' in node.callee && node.callee.name

          if (!name || !TRANSLATION_FUNCTIONS.includes(name)) {
            return
          }

          // check if function is used without having been declared
          if (varCollector.hasVar(scopeTracker.curScopeKey, name)) {
            return
          }

          missingFunctionDeclarators.add(name)
        },
        leave(_node) {
          if (_node.type === 'BlockStatement') {
            scopeTracker.leaveScope()
          }
        }
      })

      const s = new MagicString(code)
      if (missingFunctionDeclarators.size > 0) {
        debug(`injecting ${Array.from(missingFunctionDeclarators).join(', ')} declaration to ${id}`)

        // only add variables when used without having been declared
        const assignments: string[] = []
        for (const missing of missingFunctionDeclarators) {
          assignments.push(TRANSLATION_FUNCTIONS_MAP[missing])
        }

        // add variable declaration at the start of <script>, `autoImports` does the rest
        s.overwrite(
          scriptSetup.loc.start.offset,
          scriptSetup.loc.end.offset,
          `\nconst { ${assignments.join(', ')} } = useI18n()\n` + scriptSetup.content
        )
      }

      if (s.hasChanged()) {
        debug('transformed: id -> ', id)
        debug('transformed: code -> ', s.toString())
        return {
          code: s.toString(),
          map: options.sourcemap ? s.generateMap({ hires: true }) : undefined
        }
      }
    }
  }
}

// from https://github.com/nuxt/nuxt/blob/a80d1a0d6349bf1003666fc79a513c0d7370c931/packages/nuxt/src/pages/utils.ts#L138-L147
const SFC_SCRIPT_RE = /<script\s*[^>]*>([\s\S]*?)<\/script\s*[^>]*>/i
function extractScriptContent(html: string) {
  const match = html.match(SFC_SCRIPT_RE)

  if (match && match[1]) {
    return match[1].trim()
  }

  return null
}

// from https://github.com/nuxt/nuxt/blob/a80d1a0d6349bf1003666fc79a513c0d7370c931/packages/vite/src/plugins/composable-keys.ts#L148-L184
/*
 * track scopes with unique keys. for example
 * ```js
 * // root scope, marked as ''
 * function a () { // '0'
 *   function b () {} // '0-0'
 *   function c () {} // '0-1'
 * }
 * function d () {} // '1'
 * // ''
 * ```
 * */
class ScopeTracker {
  // the top of the stack is not a part of current key, it is used for next level
  scopeIndexStack: number[]
  curScopeKey: string

  constructor() {
    this.scopeIndexStack = [0]
    this.curScopeKey = ''
  }

  getKey() {
    return this.scopeIndexStack.slice(0, -1).join('-')
  }

  enterScope() {
    this.scopeIndexStack.push(0)
    this.curScopeKey = this.getKey()
  }

  leaveScope() {
    this.scopeIndexStack.pop()
    this.curScopeKey = this.getKey()
    this.scopeIndexStack[this.scopeIndexStack.length - 1]++
  }
}

// from https://github.com/nuxt/nuxt/blob/a80d1a0d6349bf1003666fc79a513c0d7370c931/packages/vite/src/plugins/composable-keys.ts#L186-L238
class ScopedVarsCollector {
  curScopeKey: string
  all: Map<string, Set<string>>

  constructor() {
    this.all = new Map()
    this.curScopeKey = ''
  }

  refresh(scopeKey: string) {
    this.curScopeKey = scopeKey
  }

  addVar(name: string) {
    let vars = this.all.get(this.curScopeKey)
    if (!vars) {
      vars = new Set()
      this.all.set(this.curScopeKey, vars)
    }
    vars.add(name)
  }

  hasVar(scopeKey: string, name: string) {
    const indices = scopeKey.split('-').map(Number)
    for (let i = indices.length; i >= 0; i--) {
      if (this.all.get(indices.slice(0, i).join('-'))?.has(name)) {
        return true
      }
    }
    return false
  }

  collect(n: Pattern) {
    const t = n.type
    if (t === 'Identifier') {
      this.addVar(n.name)
    } else if (t === 'RestElement') {
      this.collect(n.argument)
    } else if (t === 'AssignmentPattern') {
      this.collect(n.left)
    } else if (t === 'ArrayPattern') {
      n.elements.forEach(e => e && this.collect(e))
    } else if (t === 'ObjectPattern') {
      n.properties.forEach(p => {
        if (p.type === 'RestElement') {
          this.collect(p)
        } else {
          this.collect(p.value)
        }
      })
    }
  }
}
