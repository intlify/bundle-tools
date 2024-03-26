import { vi } from 'vitest'
import { checkInstallPackage, loadModule, getVueI18nVersion } from '../src/deps'

test.skip('vue-i18n', () => {
  expect(checkInstallPackage('vue-i18n', vi.fn())).toBe('vue-i18n')
})

test.skip('loadModule', () => {
  expect(loadModule('yaml-eslint-parser', vi.fn())).not.toBe(null)
})

test.skip('getVueI18nVersion', () => {
  expect(getVueI18nVersion(vi.fn())).toBe('9')
})
