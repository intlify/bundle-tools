import { generate as generateYAML } from '../../src/yaml'

const BOM = '\uFEFF'
const types = ['plain', 'sfc', 'bare'] as const
const source = 'en:\n  hello: hello\n'

describe('yaml that starts with a BOM generates the same code as without it', () => {
  for (const type of types) {
    test(`type: ${type}`, () => {
      const options = { type, filename: '/path/to/ja.yaml', sourceMap: true }
      const withBom = generateYAML(`${BOM}${source}`, options)
      const withoutBom = generateYAML(source, options)
      expect(withBom.code).toBe(withoutBom.code)
      expect(withBom.map).toEqual(withoutBom.map)
    })
  }

  test('Buffer', () => {
    const options = { type: 'plain', filename: '/path/to/ja.yaml', sourceMap: true } as const
    const withBom = generateYAML(Buffer.from(`${BOM}${source}`), options)
    const withoutBom = generateYAML(Buffer.from(source), options)
    expect(withBom.code).toBe(withoutBom.code)
    expect(withBom.map).toEqual(withoutBom.map)
  })

  test('only a BOM', () => {
    const options = { type: 'plain', filename: '/path/to/ja.yaml' } as const
    expect(generateYAML(BOM, options).code).toBe(generateYAML('', options).code)
  })
})

test('syntax error on the first line has the same position as without a BOM', () => {
  const options = { type: 'plain', filename: '/path/to/ja.yaml' } as const
  expect(() => generateYAML(`${BOM}en: @x\n`, options)).toThrowError(
    'Plain value cannot start with reserved character @ in /path/to/ja.yaml (1:5)'
  )
})
