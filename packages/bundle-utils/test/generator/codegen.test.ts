import { generateMessageFunction, generateResourceAst } from '../../src/codegen'

describe('generateResourceAst', () => {
  test('development', () => {
    expect(generateResourceAst('hello')).toMatchSnapshot()
  })
  test('production', () => {
    expect(
      generateResourceAst('hello', {
        env: 'production',
        jit: true,
        minify: true
      })
    ).toMatchSnapshot()
  })
  test('syntax error', () => {
    const errors: string[] = []
    const { code } = generateResourceAst(`|`, {
      onError(msg) {
        errors.push(msg)
      }
    })
    expect(errors.length).toBe(1)
    expect(code).toBe('`|`')
  })
})

describe('generateMessageFunction', () => {
  test('development', () => {
    expect(
      generateMessageFunction('hello', {
        sourceMap: true
      })
    ).toMatchSnapshot()
  })

  test('production', () => {
    expect(generateMessageFunction('hello', { env: 'production' })).toMatchSnapshot()
  })

  test('syntax error', () => {
    const errors: string[] = []
    const { code } = generateMessageFunction(`|`, {
      onError(msg) {
        errors.push(msg)
      }
    })
    expect(errors.length).toBe(1)
    expect(code).toBe('`|`')
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

// The message compiler leaves only the error code in the message of its errors when `NODE_ENV`
// is `production` (as during `vite build`); the generators put the text back.
describe('compile errors when NODE_ENV is production', () => {
  let nodeEnv: string | undefined
  beforeEach(() => {
    nodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
  })
  afterEach(() => {
    if (nodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = nodeEnv
    }
  })

  test('generateMessageFunction', () => {
    const errors: string[] = []
    generateMessageFunction('hello {name', {
      onError(msg) {
        errors.push(msg)
      }
    })
    expect(errors).toEqual(['Unterminated closing brace'])
  })

  test('generateResourceAst', () => {
    const errors: string[] = []
    generateResourceAst('hello {name', {
      onError(msg) {
        errors.push(msg)
      }
    })
    expect(errors).toEqual(['Unterminated closing brace'])
  })

  test('drops the placeholder of an argument the text had', () => {
    const errors: string[] = []
    generateResourceAst('{.}', {
      onError(msg) {
        errors.push(msg)
      }
    })
    // 12.0.0-alpha.4 / alpha.5 of the message compiler keep the whole text, with the argument,
    // as their bundler and Node.js builds always took the development branches
    expect(errors).toEqual([expect.stringMatching(/^Invalid token in placeholder(: '\.')?$/)])
  })
})
