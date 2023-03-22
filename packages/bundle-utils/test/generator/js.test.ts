import { readFile, validateSyntax } from '../utils'
import { generate } from '../../src/js'

test('simple', async () => {
  const { source } = await readFile('./fixtures/codegen/simple.js')
  const { code, map } = generate(source, {
    sourceMap: true,
    env: 'development'
  })

  expect(validateSyntax(code)).toBe(true)
  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('unhandling', async () => {
  const { source } = await readFile('./fixtures/codegen/unhanding.js')
  const { code, map } = generate(source, {
    sourceMap: true,
    env: 'development'
  })

  expect(validateSyntax(code)).toBe(true)
  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('force stringify', async () => {
  const { source } = await readFile('./fixtures/codegen/unhanding.js')
  const { code, map } = generate(source, {
    sourceMap: true,
    env: 'development',
    forceStringify: true
  })

  expect(validateSyntax(code)).toBe(true)
  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('complex', async () => {
  const { source } = await readFile('./fixtures/codegen/complex.js')
  const { code, map } = generate(source, {
    sourceMap: true,
    env: 'development'
  })

  expect(validateSyntax(code)).toBe(true)
  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('bare', async () => {
  const { source } = await readFile('./fixtures/bare.js')
  const { code, map } = generate(source, {
    type: 'bare',
    sourceMap: true,
    env: 'development'
  })

  expect(validateSyntax(`export default \n${code}`)).toBe(true)
  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('bridge', async () => {
  const { source } = await readFile('./fixtures/codegen/complex.js')
  const { source: json } = await readFile('./fixtures/codegen/complex.json')
  const { code, map } = generate(
    source,
    {
      type: 'sfc',
      bridge: true,
      sourceMap: true,
      env: 'development'
    },
    () => {
      return JSON.stringify(json)
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
        .replace(/\\/g, '\\\\')
        .replace(/\u0027/g, '\\u0027')
    }
  )

  expect(validateSyntax(code)).toBe(true)
  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('bridge with ESM exporting', async () => {
  const { source } = await readFile('./fixtures/codegen/complex.js')
  const { source: json } = await readFile('./fixtures/codegen/complex.json')
  const { code, map } = generate(
    source,
    {
      type: 'sfc',
      bridge: true,
      exportESM: true,
      sourceMap: true,
      env: 'development'
    },
    () => {
      return JSON.stringify(json)
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
        .replace(/\\/g, '\\\\')
        .replace(/\u0027/g, '\\u0027')
    }
  )

  expect(validateSyntax(code)).toBe(true)
  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('useClassComponent', async () => {
  const { source } = await readFile('./fixtures/codegen/complex.js')
  const { code, map } = generate(
    source,
    {
      type: 'sfc',
      useClassComponent: true,
      sourceMap: true,
      env: 'development'
    },
    () => {
      return source
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
        .replace(/\\/g, '\\\\')
        .replace(/\u0027/g, '\\u0027')
    }
  )

  expect(validateSyntax(code)).toBe(true)
  expect(code).toMatchSnapshot('code')
  expect(code).toContain('Component.__o || Component')
  expect(code).toContain('_Component.__i18n')
  expect(map).toMatchSnapshot('map')
})

test('array basic', async () => {
  const { source } = await readFile('./fixtures/codegen/array-basic.js')
  const { code, map } = generate(source, {
    type: 'sfc',
    sourceMap: true,
    env: 'development'
  })

  expect(validateSyntax(code)).toBe(true)
  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('array mixed', async () => {
  const { source } = await readFile('./fixtures/codegen/array-mix.js')
  const { code, map } = generate(source, {
    type: 'sfc',
    sourceMap: true,
    env: 'development'
  })

  expect(validateSyntax(code)).toBe(true)
  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('invalid message syntax', async () => {
  const { source } = await readFile('./fixtures/codegen/invalid-message.js')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errors = [] as any
  const { code, map } = generate(source, {
    type: 'bare',
    sourceMap: true,
    env: 'development',
    onError(msg, extra) {
      errors.push(Object.assign({ msg }, extra || {}))
    }
  })

  expect(errors).toMatchSnapshot('errors')
  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('html tag in message', async () => {
  const { source } = await readFile('./fixtures/codegen/html.js')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errors = [] as any
  const { code } = generate(source, {
    type: 'bare',
    escapeHtml: true,
    env: 'development',
    onError(msg, extra) {
      errors.push(Object.assign({ msg }, extra || {}))
    }
  })

  expect(errors).toMatchSnapshot('errors')
  expect(code).toMatchSnapshot('code')
})

test('no export default with object', async () => {
  const { source } = await readFile(
    './fixtures/codegen/no-export-default-with-object.js'
  )
  function doGenerate() {
    generate(source, {
      sourceMap: true,
      env: 'development'
    })
  }

  expect(doGenerate).toThrowError(
    `You need to define an object as the locale message with 'export default'.`
  )
})

describe(`'allowDynamic' option`, () => {
  test('no export default', async () => {
    const { source } = await readFile('./fixtures/codegen/no-export-default.js')
    function doGenerate() {
      generate(source, {
        allowDynamic: true,
        sourceMap: true,
        env: 'development'
      })
    }

    expect(doGenerate).toThrowError(
      `You need to define 'export default' that will return the locale messages.`
    )
  })

  test('no generate', async () => {
    const { source } = await readFile('./fixtures/codegen/allow-dynamic.js')
    const { code, ast } = generate(source, {
      allowDynamic: true,
      sourceMap: true,
      env: 'development'
    })

    expect(validateSyntax(code)).toBe(true)
    expect(code).toBe(source)
    expect(ast).toMatchSnapshot()
  })

  test('generate', async () => {
    const { source } = await readFile(
      './fixtures/codegen/export-default-with-object.js'
    )
    const { code, map } = generate(source, {
      allowDynamic: true,
      sourceMap: true,
      env: 'development'
    })

    expect(validateSyntax(code)).toBe(true)
    expect(code).toMatchSnapshot('code')
    expect(map).toMatchSnapshot('map')
  })
})

test('include function', async () => {
  const { source } = await readFile('./fixtures/codegen/functions.js')
  const { code, map } = generate(source, {
    sourceMap: true,
    env: 'development'
  })

  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})
