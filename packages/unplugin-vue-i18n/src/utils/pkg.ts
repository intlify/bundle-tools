// SPDX-License-Identifier: MIT
// Modified by: kazuya kawaguchi (a.k.a. kazupon)
// Auther: Pooya Parsa (https://github.com/pi0)
// Forked from: https://github.com/unjs/pkg-types
// Note: Modified to work as a synchronous API

import { statSync } from 'node:fs'
import { join, resolve, isAbsolute } from 'pathe'
import { resolvePathSync } from 'mlly'

import type { ResolveOptions as _ResolveOptions } from 'mlly'

export interface FindFileOptions {
  /**
   * The starting directory for the search.
   * @default . (same as `process.cwd()`)
   */
  startingFrom?: string
  /**
   * A pattern to match a path segment above which you don't want to ascend
   * @default /^node_modules$/
   */
  rootPattern?: RegExp
  /**
   * If true, search starts from root level descending into subdirectories
   */
  reverse?: boolean
  /**
   * A matcher that can evaluate whether the given path is a valid file (for example,
   * by testing whether the file path exists.
   *
   * @default fs.statSync(path).isFile()
   */
  test?: (filePath: string) => boolean | undefined
}

const defaultFindOptions: Required<FindFileOptions> = {
  startingFrom: '.',
  rootPattern: /^node_modules$/,
  reverse: false,
  test: (filePath: string) => {
    try {
      if (statSync(filePath).isFile()) {
        return true
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * Asynchronously finds a file by name, starting from the specified directory and traversing up (or down if reverse).
 * @param filename - The name of the file to find.
 * @param _options - Options to customise the search behaviour.
 * @returns a promise that resolves to the path of the file found.
 * @throws Will throw an error if the file cannot be found.
 */
function findFile(
  filename: string | string[],
  _options: FindFileOptions = {}
): string {
  const filenames = Array.isArray(filename) ? filename : [filename]
  const options = { ...defaultFindOptions, ..._options }
  const basePath = resolve(options.startingFrom)
  const leadingSlash = basePath[0] === '/'
  const segments = basePath.split('/').filter(Boolean)

  // Restore leading slash
  if (leadingSlash) {
    segments[0] = '/' + segments[0]
  }

  // Limit to node_modules scope if it exists
  let root = segments.findIndex(r => r.match(options.rootPattern))
  if (root === -1) {
    root = 0
  }

  if (options.reverse) {
    for (let index = root + 1; index <= segments.length; index++) {
      for (const filename of filenames) {
        const filePath = join(...segments.slice(0, index), filename)
        if (options.test(filePath)) {
          return filePath
        }
      }
    }
  } else {
    for (let index = segments.length; index > root; index--) {
      for (const filename of filenames) {
        const filePath = join(...segments.slice(0, index), filename)
        if (options.test(filePath)) {
          return filePath
        }
      }
    }
  }

  throw new Error(
    `Cannot find matching ${filename} in ${options.startingFrom} or parent directories`
  )
}

/**
 * Asynchronously finds the next file with the given name, starting in the given directory and moving up.
 * Alias for findFile without reversing the search.
 * @param filename - The name of the file to find.
 * @param _options - Options to customise the search behaviour.
 * @returns A promise that resolves to the path of the next file found.
 */
function findNearestFile(
  filename: string | string[],
  _options: FindFileOptions = {}
): string {
  return findFile(filename, _options)
}

/**
 * Represents the options for resolving paths with additional file finding capabilities.
 */
export type ResolveOptions = _ResolveOptions & FindFileOptions

/**
 * Resolves the path to the nearest `package.json` file from a given directory.
 * @param id - The base path for the search, defaults to the current working directory.
 * @param options - Options to modify the search behaviour. See {@link ResolveOptions}.
 * @returns A promise resolving to the path of the nearest `package.json` file.
 */
export function resolvePackageJSON(
  id: string = process.cwd(),
  options: ResolveOptions = {}
): string {
  const resolvedPath = isAbsolute(id) ? id : resolvePathSync(id, options)
  return findNearestFile('package.json', {
    startingFrom: resolvedPath,
    ...options
  })
}
