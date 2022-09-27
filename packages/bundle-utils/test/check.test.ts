import {
  checkInstallPackage,
  checkVueI18nBridgeInstallPackage
} from '../src/check'

test('vue-i18n', () => {
  expect(checkInstallPackage('vue-i18n', jest.fn())).toBe('vue-i18n')
})

test('vue-i18n-bridge', () => {
  expect(checkVueI18nBridgeInstallPackage(jest.fn())).toBe(false)
})
