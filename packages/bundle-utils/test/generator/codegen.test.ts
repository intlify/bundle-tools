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

  test('syntax error', () => {
    const errors: string[] = []
    const { code } = generateMessageFunction(`|`, {
      onError(msg) {
        errors.push(msg)
      }
    })
    expect(errors.length).toBe(1)
    expect(code).toBe(`'|'`)
  })

  describe('strictMessage', () => {
    test('default: should be checked', () => {
      const errors: string[] = []
      generateMessageFunction(`<p>hello</p>`, {
        onError(msg) {
          errors.push(msg)
        }
      })
      expect(errors[0]).toBe(`Detected HTML in '<p>hello</p>' message.`)
    })

    test('false: should not be checked', () => {
      const errors: string[] = []
      generateMessageFunction(`<p>hello</p>`, {
        strictMessage: false,
        onError(msg) {
          errors.push(msg)
        }
      })
      expect(errors.length).toBe(0)
    })
  })

  describe('escapeHtml', () => {
    test('default: should not be escaped', () => {
      const { code } = generateMessageFunction(`<p>hello</p>`, {})
      expect(code).toMatchSnapshot()
    })

    test('true: should be escaped', () => {
      const { code } = generateMessageFunction(`<p>hello</p>`, {
        escapeHtml: true
      })
      expect(code).toMatchSnapshot()
    })
  })
})
