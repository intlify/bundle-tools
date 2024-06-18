// SPDX-License-Identifier: MIT
// Modified by: kazuya kawaguchi (a.k.a. kazupon)
// Auther: Evan You (https://github.com/yyx990803)
// Forked from: https://github.com/vitejs/vite/tree/main/packages/plugin-vue

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
  { template, compiler }: VuePluginResolvedOptions
): SFCParseResult {
  const { descriptor, errors } = compiler.parse(source, {
    filename,
    templateParseOptions: template?.compilerOptions
  })

  return { descriptor, errors }
}

export function getDescriptor(
  filename: string,
  code: string,
  options: VuePluginResolvedOptions
): SFCDescriptor {
  const { descriptor, errors } = createDescriptor(filename, code, options)
  if (errors.length) {
    throw errors[0]
  }

  return descriptor
}
