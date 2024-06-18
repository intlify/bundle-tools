import path from 'node:path'
import createDebug from 'debug'
import { isBoolean } from '@intlify/shared'
import { transformVTDirective } from '@intlify/vue-i18n-extensions'
import { analyze as analyzeScope } from '@typescript-eslint/scope-manager'
import {
  parse,
  simpleTraverse,
  AST_NODE_TYPES
} from '@typescript-eslint/typescript-estree'
// @ts-expect-error -- FIXME: missing types
import eslintUitls from '@eslint-community/eslint-utils'
import {
  resolveNamespace,
  getVitePlugin,
  checkVuePlugin,
  normalizePath
} from '../utils'
import { parseVueRequest, getVuePluginOptions, getDescriptor } from '../vue'

import type { TranslationSignatureResolver } from '@intlify/vue-i18n-extensions'
import type { Scope } from '@typescript-eslint/scope-manager'
import {
  ParserServicesWithTypeInformation,
  TSESTree
} from '@typescript-eslint/typescript-estree'
import type { UnpluginOptions, RollupPlugin } from 'unplugin'
import type {
  VuePluginResolvedOptions,
  TranslationDirectiveResolveIndetifier
} from '../vue'
import type { ResolvedOptions } from './options'

type Node = Parameters<
  ParserServicesWithTypeInformation['getSymbolAtLocation']
>[0]

const debug = createDebug(resolveNamespace('directive'))

export function directivePlugin({
  optimizeTranslationDirective,
  translationIdentifiers
}: ResolvedOptions): UnpluginOptions {
  let vuePlugin: RollupPlugin | null = null
  let vuePluginOptions: VuePluginResolvedOptions | null = null

  return {
    name: resolveNamespace('directive'),
    enforce: 'pre',
    vite: {
      config(config) {
        // @ts-expect-error -- TODO
        vuePlugin = getVitePlugin(config, 'vite:vue')
        if (!checkVuePlugin(vuePlugin!)) {
          return
        }

        if (optimizeTranslationDirective) {
          vuePlugin!.api.options = resolveVueOptions(
            vuePlugin!,
            optimizeTranslationDirective,
            translationIdentifiers
          )
          debug(`vite:vue options['template']:`, vuePlugin!.api.options)
        }
      },

      configResolved(config) {
        vuePlugin = getVitePlugin(config, 'vite:vue')
        if (!checkVuePlugin(vuePlugin)) {
          return
        }
      }
    },

    async transform(code, id) {
      const { filename } = parseVueRequest(id)

      // lazy load vue plugin options
      if (vuePluginOptions == null) {
        vuePluginOptions = getVuePluginOptions(vuePlugin!)
      }

      if (id.endsWith('.vue')) {
        analyzeIdentifiers(
          getDescriptor(filename, code, vuePluginOptions!),
          vuePluginOptions,
          translationIdentifiers
        )
      }

      return code
    }
  }
}

function resolveVueOptions(
  vuePlugin: RollupPlugin,
  optimizeTranslationDirective: ResolvedOptions['optimizeTranslationDirective'],
  translationIdentifiers: ResolvedOptions['translationIdentifiers']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const vueOptions = vuePlugin.api.options
  vueOptions.template ||= {}
  vueOptions.template.compilerOptions ||= {}
  vueOptions.template.compilerOptions.directiveTransforms ||= {}

  /**
   * NOTE:
   * This is a custom translation signature resolver for Vue SFC.
   * The resolver works by this plugin.
   * That is analyzing the identifier of the `t` function exposed by `useI18n` in vue-i18n.
   * The analyzed identifier is replaced by the directive transform of the Vue compiler.
   */
  const translationSignatureResolver: TranslationSignatureResolver = (
    context,
    baseResolver
  ) => {
    const { filename } = context
    const vuePluginOptions = getVuePluginOptions(vuePlugin)
    const normalizedFilename = normalizePath(
      path.relative(vuePluginOptions.root, filename)
    )
    const resolveIdentifier = translationIdentifiers.get(normalizedFilename)
    debug('resolved vue-i18n Identifier', resolveIdentifier)
    if (resolveIdentifier == null) {
      return undefined
    }

    if (resolveIdentifier.type === 'identifier') {
      return baseResolver(context, resolveIdentifier.key)
    } else {
      // object
      const resolvedSignature = baseResolver(context, resolveIdentifier.key)
      return resolveIdentifier?.style === 'script-setup'
        ? `${resolvedSignature}.t`
        : resolvedSignature
    }
  }

  vueOptions.template.compilerOptions.directiveTransforms.t =
    transformVTDirective({
      translationSignatures: isBoolean(optimizeTranslationDirective)
        ? translationSignatureResolver
        : optimizeTranslationDirective
    })

  return vueOptions
}

function analyzeIdentifiers(
  descriptor: ReturnType<typeof getDescriptor>,
  { root }: VuePluginResolvedOptions,
  translationIdentifiers: Map<string, TranslationDirectiveResolveIndetifier>
) {
  const source = descriptor.scriptSetup?.content || descriptor.script?.content
  debug('getDescriptor content', source)
  if (!source) {
    return
  }

  const ast = parse(source, { range: true })
  simpleTraverse(ast, {
    enter(node, parent) {
      if (parent) {
        node.parent = parent
      }
    }
  })
  const scopeManager = analyzeScope(ast, { sourceType: 'module' })
  const scope = getScope(scopeManager, ast)

  const importLocalName = getImportLocalName(scope, 'vue-i18n', 'useI18n')
  if (importLocalName == null) {
    return
  }
  debug('importLocalName', importLocalName)
  const resolvedIdentifier = getVueI18nIdentifier(scope, importLocalName!)

  if (resolvedIdentifier) {
    const normalizedFilename = normalizePath(
      path.relative(root, descriptor.filename)
    )
    debug('set vue-i18n resolved identifier: ', resolvedIdentifier)
    translationIdentifiers.set(normalizedFilename, resolvedIdentifier)
  }
}

function getScope(manager: ReturnType<typeof analyzeScope>, node: Node): Scope {
  const scope = manager.acquire(node, true)
  if (scope) {
    if (scope.type === 'function-expression-name') {
      return scope.childScopes[0]
    }
    return scope
  }
  return manager.scopes[0]
}

function getImportLocalName(
  scope: Scope,
  source: string,
  imported: string
): string | null {
  const importDecl = getImportDeclaration(scope, source)
  if (importDecl) {
    const specifierNode = importDecl.specifiers.find(
      specifierNode =>
        isImportedIdentifierInImportClause(specifierNode) &&
        specifierNode.imported.name === imported
    )
    return specifierNode ? specifierNode.local.name : null
  }
  return null
}

function getImportDeclaration(scope: Scope, source: string) {
  const tracker = new eslintUitls.ReferenceTracker(scope)
  const traceMap = {
    [source]: {
      [eslintUitls.ReferenceTracker.ESM]: true,
      [eslintUitls.ReferenceTracker.READ]: true
    }
  }
  const refs = Array.from(tracker.iterateEsmReferences(traceMap)) satisfies {
    path: string
    node: Node
  }[]
  return refs.length ? (refs[0].node as TSESTree.ImportDeclaration) : null
}

function isImportedIdentifierInImportClause(
  node: TSESTree.ImportClause
): node is TSESTree.ImportClause & { imported: TSESTree.Identifier } {
  return 'imported' in node
}

function getVueI18nIdentifier(scope: Scope, local: string) {
  // Get the CallExpression and ReturnStatement needed for analysis from scope.
  const { callExpression, returnStatement } =
    getCallExpressionAndReturnStatement(scope, local)

  // If CallExpression cannot get, `useI18n` will not be called and exit from this function
  if (callExpression == null) {
    return null
  }

  // Get the AST Nodes from `id` prop on VariableDeclarator
  // e.g. `const { t } = useI18n()`
  //  VariableDeclarator Node: `{ t } = useI18n()`
  //  expeted AST Nodes: `{ t }`
  const id = getVariableDeclarationIdFrom(callExpression)
  if (id == null) {
    return null
  }

  // parse variable id from AST Nodes
  const variableIdPairs = parseVariableId(id)
  debug('variableIdPairs:', variableIdPairs)

  // parse variable id from RestStatement Node
  const returnVariableIdPairs = parseReturnStatement(returnStatement)
  debug('returnVariableIdPairs:', returnVariableIdPairs)

  // resolve identifier
  return resolveIdentifier(variableIdPairs, returnVariableIdPairs)
}

const EMPTY_NODE_RETURN = {
  callExpression: null,
  returnStatement: null
} as const

function getCallExpressionAndReturnStatement(
  scope: Scope,
  local: string
):
  | {
      callExpression: TSESTree.CallExpression | null
      returnStatement: TSESTree.ReturnStatement | null
    }
  | typeof EMPTY_NODE_RETURN {
  // TODO: missing types (eslint-utils)
  const variable = eslintUitls.findVariable(scope, local)
  if (variable == null) {
    return EMPTY_NODE_RETURN
  }

  // @ts-expect-error -- FIXME: missing types (eslint-utils)
  const callExpressionRef = variable.references.find(ref => {
    return ref.identifier.parent?.type === AST_NODE_TYPES.CallExpression
  })
  if (callExpressionRef == null) {
    return EMPTY_NODE_RETURN
  }

  let returnStatement: TSESTree.ReturnStatement | null = null
  if (
    callExpressionRef.from.type === 'function' &&
    callExpressionRef.from.block.type === AST_NODE_TYPES.FunctionExpression &&
    callExpressionRef.from.block.parent.type === AST_NODE_TYPES.Property &&
    callExpressionRef.from.block.parent.key.type ===
      AST_NODE_TYPES.Identifier &&
    callExpressionRef.from.block.parent.key.name === 'setup'
  ) {
    returnStatement = callExpressionRef.from.block.body.body.find(
      (statement: Node) => {
        return statement.type === AST_NODE_TYPES.ReturnStatement
      }
    ) as TSESTree.ReturnStatement | null
  }

  return {
    callExpression: callExpressionRef.identifier
      .parent as TSESTree.CallExpression,
    returnStatement
  }
}

function getVariableDeclarationIdFrom(node: TSESTree.CallExpression) {
  if (node.parent?.type !== AST_NODE_TYPES.VariableDeclarator) {
    return null
  }
  return node.parent.id as TSESTree.Identifier | TSESTree.ObjectPattern
}

type VariableIdPair = {
  key: string | null
  value: string | null
}

function parseVariableId(
  node: TSESTree.Identifier | TSESTree.ObjectPattern
): VariableIdPair[] {
  if (node.type === AST_NODE_TYPES.Identifier) {
    // Identifier
    // e.g `const i18n = useI18n()`
    // [{ key: 'i18n', value: null }]
    return [{ key: node.name, value: null }]
  } else {
    // ObjectPattern
    // e.g `const { t, d: datetime } = useI18n()`
    // [{ key: 't', value: 't' }, { key: 'd', value: 'datetime' }]
    const props = node.properties.filter(
      // ignore RestElement
      prop => prop.type === AST_NODE_TYPES.Property
    ) as TSESTree.Property[]
    const pairs = [] as { key: string | null; value: string | null }[]
    for (const prop of props) {
      if (
        prop?.key.type === AST_NODE_TYPES.Identifier &&
        prop?.value.type === AST_NODE_TYPES.Identifier
      ) {
        pairs.push({ key: prop.key.name, value: prop.value.name })
      }
    }
    return pairs
  }
}

function parseReturnStatement(
  node: TSESTree.ReturnStatement | null
): VariableIdPair[] {
  const pairs = [] as VariableIdPair[]
  if (node == null || node.argument == null) {
    return pairs
  }

  if (node.argument.type === AST_NODE_TYPES.ObjectExpression) {
    // ObjectExpression
    for (const prop of node.argument.properties) {
      if (prop.type === AST_NODE_TYPES.Property) {
        if (
          prop.key.type === AST_NODE_TYPES.Identifier &&
          prop.value.type === AST_NODE_TYPES.Identifier
        ) {
          // Identifier
          // e.g `return { t, d: datetime }`
          // [{ key: 't', value: 't' }, { key: 'd', value: 'datetime' }]
          pairs.push({ key: prop.key.name, value: prop.value.name })
        } else if (
          prop.key.type === AST_NODE_TYPES.Identifier &&
          prop.value.type === AST_NODE_TYPES.MemberExpression &&
          prop.value.object.type === AST_NODE_TYPES.Identifier &&
          prop.value.property.type === AST_NODE_TYPES.Identifier
        ) {
          // MemberExpression
          // e.g `return { t: i18n.t }`
          // [{ key: 't', value: 'i18n.t' }]
          pairs.push({
            key: prop.key.name,
            value: `${prop.value.object.name}.${prop.value.property.name}`
          })
        }
      }
    }
    return pairs
  } else if (node.argument.type === AST_NODE_TYPES.Identifier) {
    // Identifier
    // e.g `return i18n`
    return pairs
  } else {
    // other AST Nodes
    return pairs
  }
}

function resolveIdentifier(
  localVariables: VariableIdPair[],
  returnVariable: VariableIdPair[]
): TranslationDirectiveResolveIndetifier | null {
  if (returnVariable.length === 0) {
    // for `<script setup>`
    const variable = localVariables.find(pair => pair.key === 't')
    if (variable && variable.value) {
      return { type: 'identifier', key: variable.value }
    }
    const identifierOnly = localVariables.find(pair => pair.value === null)
    if (identifierOnly && identifierOnly.key) {
      return { type: 'object', key: identifierOnly.key, style: 'script-setup' }
    }
    return null
  } else {
    // for `setup() {}` hook
    const variable = localVariables.find(pair => pair.key === 't')
    if (variable && variable.value) {
      const returnVar = returnVariable.find(
        pair => pair.value === variable.value
      )
      if (returnVar && returnVar.key) {
        return { type: 'identifier', key: returnVar.key }
      }
    }
    const identifierOnly = localVariables.find(pair => pair.value === null)
    if (identifierOnly && identifierOnly.key) {
      const targetKey = identifierOnly.key
      const returnVar = returnVariable.find(pair =>
        pair.value?.startsWith(targetKey)
      )
      if (returnVar && returnVar.key) {
        return { type: 'object', key: returnVar.key, style: 'setup-hook' }
      }
    }
    return null
  }
}
