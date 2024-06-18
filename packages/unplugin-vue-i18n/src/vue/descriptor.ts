// SPDX-License-Identifier: MIT
// Modified by: kazuya kawaguchi (a.k.a. kazupon)
// Auther: Evan You (https://github.com/yyx990803)
// Forked from: https://github.com/vitejs/vite/tree/main/packages/plugin-vue

import path from 'node:path'
import { normalizePath } from '../utils'

import type { CompilerError, SFCDescriptor } from 'vue/compiler-sfc'
import type { VuePluginResolvedOptions } from './utils'

// compiler-sfc should be exported so it can be re-used
export interface SFCParseResult {
  descriptor: SFCDescriptor
  errors: (CompilerError | SyntaxError)[]
}

export function createDescriptor(
  filename: string,
  source: string,
  { root, template, compiler }: VuePluginResolvedOptions
  // { root, isProduction, sourceMap, compiler, template }: ResolvedOptions,
  // hmr = false
): SFCParseResult {
  const { descriptor, errors } = compiler.parse(source, {
    filename,
    templateParseOptions: template?.compilerOptions
    // sourceMap,
    // templateParseOptions: template?.compilerOptions
  })

  // ensure the path is normalized in a way that is consistent inside
  // project (relative to root) and on different systems.
  // const normalizedPath = normalizePath(path.relative(root!, filename))
  // descriptor.id = getHash(normalizedPath + (isProduction ? source : ''))
  // ;(hmr ? hmrCache : cache).set(filename, descriptor)
  return { descriptor, errors }
}

export function getDescriptor(
  filename: string,
  code: string,
  options: VuePluginResolvedOptions
  // options: ResolvedOptions,
  // createIfNotFound = true,
  // hmr = false,
  // code?: string
): SFCDescriptor {
  const { descriptor, errors } = createDescriptor(filename, code, options)
  if (errors.length) {
    throw errors[0]
  }

  return descriptor
  // const _cache = hmr ? hmrCache : cache
  // if (_cache.has(filename)) {
  //   return _cache.get(filename)!
  // }
  // if (createIfNotFound) {
  //   const { descriptor, errors } = createDescriptor(
  //     filename,
  //     code ?? fs.readFileSync(filename, 'utf-8'),
  //     options,
  //     hmr
  //   )
  //   if (errors.length && !hmr) {
  //     throw errors[0]
  //   }
  //   return descriptor
  // }
}
