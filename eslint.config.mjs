import {
  defineConfig,
  javascript,
  prettier,
  typescript
} from '@kazupon/eslint-config'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

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
  prettier(),
  {
    name: 'ignores',
    ignores: [
      'packages/rollup-plugin-vue-i18n/*',
      'packages/vite-plugin-vue-i18n/*',
      'packages/vue-i18n-loader/*',
      'packages/unplugin-vue-i18n/lib/*',
      'packages/bundle-utils/lib/*',
      'examples/*',
      '**/test/fixtures/**',
      '**/*.config.ts',
      '**/dist/**',
      '**/.eslint-config-inspector/**',
      '**/tsconfig.json',
      '**/*.yml',
      '**/*.yaml',
      '**/*.json',
      '**/*.json5',
      '**/*.jsonc',
      '**/*.vue'
    ]
  },
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
