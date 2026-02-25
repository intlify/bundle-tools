import type { TreeShakingOptions } from '../types'

export interface UsedKeysCollector {
  readonly usedKeys: Set<string>
  dynamicKeysDetected: boolean
  readonly safelistPatterns: string[]
  readonly removedKeys: Map<string, string[]>

  addKey(key: string): void
  markDynamic(): void
  shouldKeepKey(keyPath: string): boolean
  reportRemoved(filename: string, keyPath: string): void
  getDiagnostics(): { totalRemoved: number; byFile: Map<string, string[]> }
}

function matchSafelistPattern(keyPath: string, pattern: string): boolean {
  // Convert glob pattern to regex:
  // '**' matches any characters including dots
  // '*' matches any characters except dots
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^.]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*')
  return new RegExp(`^${regexStr}$`).test(keyPath)
}

export function createUsedKeysCollector(options: TreeShakingOptions): UsedKeysCollector {
  const usedKeys = new Set<string>()
  const safelistPatterns = options.safelist || []
  const dynamicKeyStrategy = options.dynamicKeyStrategy || 'keep-all'
  const removedKeys = new Map<string, string[]>()
  let dynamicKeysDetected = false

  return {
    get usedKeys() {
      return usedKeys
    },
    get dynamicKeysDetected() {
      return dynamicKeysDetected
    },
    set dynamicKeysDetected(val: boolean) {
      dynamicKeysDetected = val
    },
    safelistPatterns,
    removedKeys,

    addKey(key: string) {
      usedKeys.add(key)
    },

    markDynamic() {
      dynamicKeysDetected = true
    },

    shouldKeepKey(keyPath: string): boolean {
      // If dynamic keys detected and strategy is keep-all, keep everything
      if (dynamicKeysDetected && dynamicKeyStrategy === 'keep-all') {
        return true
      }

      // Check safelist patterns
      if (safelistPatterns.some(pattern => matchSafelistPattern(keyPath, pattern))) {
        return true
      }

      // Exact match
      if (usedKeys.has(keyPath)) {
        return true
      }

      // Prefix match: keep parent objects needed for nested keys
      // e.g., if 'nav.home' is used, keep 'nav' (the parent object)
      for (const key of usedKeys) {
        if (key.startsWith(keyPath + '.')) {
          return true
        }
      }

      return false
    },

    reportRemoved(filename: string, keyPath: string) {
      const existing = removedKeys.get(filename)
      if (existing) {
        existing.push(keyPath)
      } else {
        removedKeys.set(filename, [keyPath])
      }
    },

    getDiagnostics() {
      let totalRemoved = 0
      for (const keys of removedKeys.values()) {
        totalRemoved += keys.length
      }
      return { totalRemoved, byFile: removedKeys }
    }
  }
}
