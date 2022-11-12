import {
  checkInstallPackage,
  checkVueI18nBridgeInstallPackage,
  loadModule,
  isInstalledVue2
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

test('isInstalledVue2', () => {
  expect(isInstalledVue2(jest.fn())).toBe(true)
})
