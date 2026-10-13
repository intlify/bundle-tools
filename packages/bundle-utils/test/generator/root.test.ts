import { parseSync } from 'oxc-parser'
import { generate as generateJSON } from '../../src/json'
import { generate as generateYAML } from '../../src/yaml'

const types = ['plain', 'sfc', 'bare'] as const

// `validateSyntax` in `../utils` cannot be used to check broken code,
// because `parseSync` reports syntax errors in `errors` instead of throwing them
function isValidSyntax(code: string, type: (typeof types)[number]): boolean {
  // `bare` generates an expression, so parse it as the default export
  const source = type === 'bare' ? `export default ${code}` : code
  return parseSync('test.js', source, { sourceType: 'module' }).errors.length === 0
}

// replace the generated message functions, to check the message keys
function replaceMessageFunctions(code: string): string {
  return code.replace(/\(\(\)=>\{const fn=.*?return fn;\}\)\(\)/g, '<fn>')
}

describe('empty or null top-level value is treated as an empty object', () => {
  const yamlSources = ['', '# TODO\n', '---\n', '...\n', '~\n', 'null\n', '!!null\n', '&a\n']

  for (const type of types) {
    for (const source of yamlSources) {
      test(`yaml (${type}): ${JSON.stringify(source)}`, () => {
        const { code } = generateYAML(source, { type, filename: '/path/to/ja.yaml' })
        expect(code).toBe(generateYAML('{}', { type, filename: '/path/to/ja.yaml' }).code)
        expect(isValidSyntax(code, type)).toBe(true)
      })
    }

    test(`json (${type}): null`, () => {
      const { code } = generateJSON('null', { type, filename: '/path/to/ja.json' })
      expect(code).toBe(generateJSON('{}', { type, filename: '/path/to/ja.json' }).code)
      expect(isValidSyntax(code, type)).toBe(true)
    })
  }
})

describe('non-object top-level value throws an error with the file name', () => {
  const yamlCases = [
    ['hello\n', 'a string'],
    ['1\n', 'a number'],
    ['true\n', 'a boolean'],
    ['- a\n- b\n', 'an array'],
    ['["a"]\n', 'an array'],
    ['&a hello\n', 'a string'],
    ['!!str null\n', 'a string'],
    ['!!str 1\n', 'a string'],
    ['*a\n', 'an alias']
  ] as const

  for (const [source, actual] of yamlCases) {
    test(`yaml (sfc): ${JSON.stringify(source)}`, () => {
      expect(() =>
        generateYAML(source, { type: 'sfc', filename: '/path/to/App.vue' })
      ).toThrowError(
        `You need to define an object as the locale messages at the top level, but got ${actual} in the i18n custom block of /path/to/App.vue.`
      )
    })

    test(`yaml (plain): ${JSON.stringify(source)}`, () => {
      expect(() =>
        generateYAML(source, { type: 'plain', filename: '/path/to/ja.yaml' })
      ).toThrowError(
        `You need to define an object as the locale messages at the top level, but got ${actual} in /path/to/ja.yaml.`
      )
    })
  }

  const json5Cases = [
    ['"hello"', 'a string'],
    ['1', 'a number'],
    ['-1', 'a number'],
    ['true', 'a boolean'],
    ['["a"]', 'an array'],
    ['Infinity', 'a number'],
    ['undefined', 'undefined'],
    ['`x`', 'a string']
  ] as const

  for (const [source, actual] of json5Cases) {
    test(`json5 (plain): ${source}`, () => {
      expect(() =>
        generateJSON(source, { type: 'plain', filename: '/path/to/ja.json5' })
      ).toThrowError(
        `You need to define an object as the locale messages at the top level, but got ${actual} in /path/to/ja.json5.`
      )
    })
  }
})

test('yaml with more than one non-empty document throws an error', () => {
  expect(() =>
    generateYAML('en:\n  hello: hello\n---\nja:\n  hello: konnichiwa\n', {
      type: 'plain',
      filename: '/path/to/ja.yaml'
    })
  ).toThrowError(
    'You need to define the locale messages in a single YAML document, but got 2 documents in /path/to/ja.yaml.'
  )
})

describe('parse error', () => {
  test('includes the file name and the 1-based position', () => {
    expect(() =>
      generateJSON('{\n  "a": }\n', { type: 'plain', filename: '/path/to/ja.json' })
    ).toThrowError(`Unexpected token '}'. in /path/to/ja.json (2:8)`)
    expect(() =>
      generateYAML('a: b: c\n', { type: 'plain', filename: '/path/to/ja.yaml' })
    ).toThrowError('Nested mappings are not allowed in compact mappings in /path/to/ja.yaml (1:4)')
  })

  test('points to empty JSON and the i18n custom block', () => {
    expect(() => generateJSON('', { type: 'plain', filename: '/path/to/ja.json' })).toThrowError(
      'Expected to be an expression, but got empty. in /path/to/ja.json (1:1)'
    )
    expect(() =>
      generateYAML('a: b: c\n', { type: 'sfc', filename: '/path/to/App.vue' })
    ).toThrowError(/in the i18n custom block of \/path\/to\/App\.vue \(\d+:\d+\)$/)
  })
})

describe('top-level mapping is generated as before', () => {
  test('with an anchor or a tag', () => {
    const expected = generateYAML('en:\n  hello: hello\n', { type: 'plain' }).code
    expect(generateYAML('&root\nen:\n  hello: hello\n', { type: 'plain' }).code).toBe(expected)
    expect(generateYAML('!!map\nen:\n  hello: hello\n', { type: 'plain' }).code).toBe(expected)
  })

  test('with an empty document before or after', () => {
    const expected = generateYAML('en:\n  hello: hello\n', { type: 'plain' }).code
    expect(generateYAML('---\nen:\n  hello: hello\n', { type: 'plain' }).code).toBe(expected)
    expect(generateYAML('en:\n  hello: hello\n---\n', { type: 'plain' }).code).toBe(expected)
  })
})

describe('onlyLocales', () => {
  test('keeps the messages of yaml that ends with an empty document', () => {
    const { code } = generateYAML('en:\n  hello: hello\n---\n', {
      type: 'sfc',
      onlyLocales: ['en']
    })
    expect(replaceMessageFunctions(code)).toContain('"hello": <fn>')
  })

  test('resolves the values with the YAML version of the document', () => {
    const { code } = generateYAML('%YAML 1.1\n---\nen:\n  count: !!int 077\n', {
      type: 'sfc',
      onlyLocales: ['en']
    })
    // `077` is an octal number in YAML 1.1
    expect(code).toContain('"count": 63')
  })

  test('does not hide a non-object top-level value', () => {
    expect(() =>
      generateYAML('hello\n', { type: 'sfc', onlyLocales: ['en'], filename: '/path/to/App.vue' })
    ).toThrowError('but got a string in the i18n custom block of /path/to/App.vue.')
  })
})
