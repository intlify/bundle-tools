import { generateLegacyCode } from '../src/legacy'

test('not global', () => {
  expect(
    generateLegacyCode({ isGlobal: false }, () =>
      JSON.stringify({ foo: 'bar' })
    )
  ).toMatch('Component.options.__i18n =')
})

test('global', () => {
  expect(
    generateLegacyCode({ isGlobal: true }, () => JSON.stringify({ foo: 'bar' }))
  ).toMatch('Component.options.__i18nGlobal =')
})

test('vue 2.7', () => {
  expect(
    generateLegacyCode({ vueVersion: 'v2.7' }, () =>
      JSON.stringify({ foo: 'bar' })
    )
  ).toMatch('Component.__i18n =')
})
