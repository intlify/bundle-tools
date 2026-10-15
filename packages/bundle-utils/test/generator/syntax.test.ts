import { generate as generateJavaScript } from '../../src/js'
import { generate as generateTypescript } from '../../src/ts'

// oxc reports a syntax error in `errors` instead of throwing it,
// so the generators have to report it themselves
describe('syntax errors in JS resources', () => {
  test('throws a SyntaxError with the file name and the position', () => {
    const generate = () =>
      generateJavaScript('export default { hello: }', { filename: '/path/to/en.js' })
    expect(generate).toThrowError(SyntaxError)
    expect(generate).toThrowError('Unexpected token in /path/to/en.js (1:25)')
  })

  test('counts lines and columns from 1', () => {
    expect(() =>
      generateJavaScript('export default {\n  hello: \n}', { filename: '/path/to/en.js' })
    ).toThrowError('Unexpected token in /path/to/en.js (3:1)')
  })

  test('an error that the parser recovers from', () => {
    expect(() =>
      generateJavaScript("return\nexport default { hello: 'hello' }", {
        filename: '/path/to/en.js'
      })
    ).toThrowError(
      "A 'return' statement can only be used within a function body. in /path/to/en.js (1:1)"
    )
  })

  test('allowDynamic', () => {
    expect(() =>
      generateJavaScript('export default { hello: }', {
        filename: '/path/to/en.js',
        allowDynamic: true
      })
    ).toThrowError('Unexpected token in /path/to/en.js (1:25)')
  })
})

describe('syntax errors in TS resources', () => {
  test('throws a SyntaxError with the file name and the position', () => {
    const generate = () =>
      generateTypescript('export default { hello: } as const', { filename: '/path/to/en.ts' })
    expect(generate).toThrowError(SyntaxError)
    expect(generate).toThrowError('Unexpected token in /path/to/en.ts (1:25)')
  })

  test('a broken type annotation', () => {
    expect(() =>
      generateTypescript("const m: = { hello: 'hello' }\nexport default m", {
        filename: '/path/to/en.ts'
      })
    ).toThrowError('Unexpected token in /path/to/en.ts (1:10)')
  })
})
