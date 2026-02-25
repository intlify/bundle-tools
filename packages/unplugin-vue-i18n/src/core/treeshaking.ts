import fg from 'fast-glob'
import { promises as fs } from 'node:fs'
import createDebug from 'debug'
import { resolveNamespace } from '../utils'
import { warn } from '../utils/log'
import { analyzeFile } from './key-analyzer'

import type { UnpluginOptions } from 'unplugin'
import type { UsedKeysCollector } from './collector'
import type { ResolvedOptions } from './options'

const debug = createDebug(resolveNamespace('tree-shaking'))

export function treeShakingPlugin(
  resolvedOptions: ResolvedOptions,
  collector: UsedKeysCollector
): UnpluginOptions {
  let projectRoot = ''

  return {
    name: resolveNamespace('tree-shaking'),
    enforce: 'pre',

    vite: {
      configResolved(config) {
        projectRoot = config.root
      }
    },

    webpack(compiler) {
      projectRoot = compiler.options.context || process.cwd()
    },

    async buildStart() {
      const treeShaking = resolvedOptions.treeShaking
      const patterns = treeShaking?.scanPatterns || [`${projectRoot}/src/**/*.{vue,ts,js,tsx,jsx}`]

      debug('scanning patterns:', patterns)

      const files = await fg(patterns, {
        ignore: ['**/node_modules/**'],
        absolute: true
      })

      debug(`found ${files.length} source files to scan`)

      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8')
          await analyzeFile(content, file, collector)
        } catch (err) {
          debug(`failed to analyze file: ${file}`, err)
        }
      }

      debug(
        `scan complete: ${collector.usedKeys.size} used keys found, dynamic: ${collector.dynamicKeysDetected}`
      )

      if (collector.dynamicKeysDetected) {
        const strategy = treeShaking?.dynamicKeyStrategy || 'keep-all'
        if (strategy === 'keep-all') {
          warn(
            'Tree-shaking: dynamic key usage detected. All keys will be preserved (dynamicKeyStrategy: keep-all).'
          )
        } else {
          warn(
            'Tree-shaking: dynamic key usage detected. Unused keys will still be removed (dynamicKeyStrategy: ignore).'
          )
        }
      }
    },

    buildEnd() {
      const diagnostics = collector.getDiagnostics()
      if (diagnostics.totalRemoved > 0) {
        debug(`tree-shaking: removed ${diagnostics.totalRemoved} unused message keys`)
        for (const [file, keys] of diagnostics.byFile) {
          debug(`  ${file}: removed ${keys.length} keys (${keys.join(', ')})`)
        }
      } else {
        debug('tree-shaking: no keys removed')
      }
    }
  }
}
