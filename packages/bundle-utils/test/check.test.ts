import { checkInstallPackage } from '../src/check'

test('vue-i18n', () => {
  expect(checkInstallPackage('vue-i18n', jest.fn())).toBe('vue-i18n')
})
