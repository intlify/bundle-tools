import {
  checkInstallPackage,
  checkVueI18nBridgeInstallPackage,
  loadModule,
  getVueI18nVersion
} from '../src/deps'

test('vue-i18n', () => {
  expect(checkInstallPackage('vue-i18n', jest.fn())).toBe('vue-i18n')
})

test('vue-i18n-bridge', () => {
  expect(checkVueI18nBridgeInstallPackage(jest.fn())).toBe(false)
})

test('loadModule', () => {
  expect(loadModule('yaml-eslint-parser', jest.fn())).not.toBe(null)
})

test('getVueI18nVersion', () => {
  expect(getVueI18nVersion(jest.fn())).toBe('9')
})
