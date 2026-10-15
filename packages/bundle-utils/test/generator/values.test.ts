import { runInThisContext } from 'node:vm'
import { generate as generateJSON } from '../../src/json'
import { generate as generateYAML } from '../../src/yaml'

const types = ['plain', 'sfc', 'bare'] as const

// run the generated code, and return the resource it makes
function evaluate(code: string, type: (typeof types)[number]): any {
  if (type === 'bare') {
    return runInThisContext(`(${code})`)
  }
  // `plain` and `sfc` end with `export default ...`, so return it from a function instead
  const value = runInThisContext(`(() => {${code.replace(/^export default /m, 'return ')}})()`)
  if (type === 'plain') {
    return value
  }
  const component = {} as { __i18n: { resource: unknown }[] }
  value(component)
  return component.__i18n[0].resource
}

describe('JSON values that are not literals', () => {
  const properties = `{
  "en": {
    "negative": -1,
    "plus": +1,
    "negativeZero": -0,
    "negativeHex": -0x10,
    "infinity": Infinity,
    "negativeInfinity": -Infinity,
    "nan": NaN,
    "undefined": undefined,
    "template": \`hello {name}\`,
    "sum": 1 + 2,
    "after": { "message": "hello" }
  }
}`
  const elements = `{
  "en": {
    "first": [-1, 2],
    "last": [1, -2],
    "mixed": [\`a\`, -1, Infinity, "b"]
  }
}`

  for (const type of types) {
    test(`property values (${type})`, () => {
      const { code } = generateJSON(properties, { type, filename: '/path/to/en.json5' })
      const { en } = evaluate(code, type)
      expect(en.negative).toBe(-1)
      expect(en.plus).toBe(1)
      expect(en.negativeZero).toBe(-0)
      expect(en.negativeHex).toBe(-16)
      expect(en.infinity).toBe(Infinity)
      expect(en.negativeInfinity).toBe(-Infinity)
      expect(en.nan).toBeNaN()
      expect('undefined' in en).toBe(true)
      expect(en.undefined).toBeUndefined()
      expect(en.template.source).toBe('hello {name}')
      expect(en.sum).toBe(3)
      expect(en.after.message.source).toBe('hello')
    })

    test(`array elements (${type})`, () => {
      const { code } = generateJSON(elements, { type, filename: '/path/to/en.json5' })
      const { en } = evaluate(code, type)
      expect(en.first).toEqual([-1, 2])
      expect(en.last).toEqual([1, -2])
      expect(en.mixed).toHaveLength(4)
      expect(en.mixed[0].source).toBe('a')
      expect(en.mixed.slice(1, 3)).toEqual([-1, Infinity])
      expect(en.mixed[3].source).toBe('b')
    })
  }

  test('forceStringify', () => {
    const { code } = generateJSON(
      '{ "en": { "negative": -1, "infinity": Infinity, "list": [-1] } }',
      {
        type: 'bare',
        forceStringify: true,
        filename: '/path/to/en.json5'
      }
    )
    const { en } = evaluate(code, 'bare')
    expect(en.negative.source).toBe('-1')
    expect(en.infinity.source).toBe('Infinity')
    expect(en.list[0].source).toBe('-1')
  })

  test('jit', () => {
    const { code } = generateJSON('{ "en": { "negative": -1, "list": [1, -2] } }', {
      type: 'bare',
      jit: true,
      filename: '/path/to/en.json'
    })
    const { en } = evaluate(code, 'bare')
    expect(en.negative).toBe(-1)
    expect(en.list).toEqual([1, -2])
  })
})

describe('YAML numbers that JSON cannot write', () => {
  const source = `en:
  infinity: .inf
  negativeInfinity: -.inf
  nan: .nan
  negativeZero: -0
  list: [-1, .inf, .nan]
`

  for (const type of types) {
    test(`numbers (${type})`, () => {
      const { code } = generateYAML(source, { type, filename: '/path/to/en.yaml' })
      const { en } = evaluate(code, type)
      expect(en.infinity).toBe(Infinity)
      expect(en.negativeInfinity).toBe(-Infinity)
      expect(en.nan).toBeNaN()
      expect(en.negativeZero).toBe(-0)
      expect(en.list).toEqual([-1, Infinity, NaN])
    })
  }

  test('forceStringify', () => {
    const { code } = generateYAML('en:\n  infinity: .inf\n  list: [.nan]\n', {
      type: 'bare',
      forceStringify: true,
      filename: '/path/to/en.yaml'
    })
    const { en } = evaluate(code, 'bare')
    expect(en.infinity.source).toBe('Infinity')
    expect(en.list[0].source).toBe('NaN')
  })
})

describe('tree-shaking', () => {
  test('keeps negative numbers', () => {
    const { code } = generateJSON('{ "negative": -1, "list": [1, -2], "unused": "unused" }', {
      type: 'bare',
      filename: '/path/to/en.json',
      usedKeyFilter: keyPath => keyPath !== 'unused'
    })
    const resource = evaluate(code, 'bare')
    expect(resource.negative).toBe(-1)
    expect(resource.list).toEqual([1, -2])
    expect('unused' in resource).toBe(false)
  })
})
