import { generateMessageFunction } from '../../src/codegen'

describe('generateMessageFunction', () => {
  test('development', () => {
    expect(
      generateMessageFunction('hello', {
        sourceMap: true
      })
    ).toMatchSnapshot()
  })

  test('production', () => {
    expect(
      generateMessageFunction('hello', { env: 'production' })
    ).toMatchSnapshot()
  })
})
