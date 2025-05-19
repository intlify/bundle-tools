import {
  comments,
  defineConfig,
  javascript,
  jsonc,
  markdown,
  prettier,
  promise,
  regexp,
  typescript,
  vitest,
  yaml
} from '@kazupon/eslint-config'
import { globalIgnores } from 'eslint/config'
import { resolve } from 'node:path'

import type { Linter } from 'eslint'

const __dirname = import.meta.dirname

export default defineConfig(
  javascript(),
  typescript({
    parserOptions: {
      project: [
        resolve(__dirname, './tsconfig.json'),
        resolve(__dirname, './packages/unplugin-vue-i18n/tsconfig.json')
      ]
    }
  }),
  comments({
    kazupon: {
      rules: {
        '@kazupon/enforce-header-comment': 'off'
      }
    }
  }),
  promise(),
  regexp(),
  jsonc({
    json: true,
    json5: true,
    jsonc: true
  }),
  yaml(),
  markdown(),
  vitest(),
  prettier(),
  {
    name: 'docs',
    files: ['**/*.md/*.ts', '**/*.md/*.js'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },
  globalIgnores([
    'examples/**',
    '.unmaintained/**',
    'packages/**/CHANGELOG.md',
    '**/*.md/*.ts',
    '**/test/fixtures/**',
    '**/*.config.ts',
    '**/dist/**',
    '**/lib/**',
    '**/.eslint-config-inspector/**',
    '**/tsconfig.json',
    '**/*.yml',
    '**/*.yaml',
    '**/*.json',
    '**/*.json5',
    '**/*.jsonc',
    '**/*.vue'
  ]) as Linter.Config,
  {
    rules: {
      'no-case-declarations': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off'
    }
  }
)
