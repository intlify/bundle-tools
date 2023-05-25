import { readFile, validateSyntax } from '../utils'
import { generate } from '../../src/json'

test('simple', async () => {
  const { source } = await readFile('./fixtures/codegen/simple.json')
  const { code, map } = generate(source, {
    sourceMap: true,
    env: 'development'
  })

  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('unhandling', async () => {
  const { source } = await readFile('./fixtures/codegen/unhanding.json')
  const { code, map } = generate(source, {
    sourceMap: true,
    env: 'development'
  })

  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('force stringify', async () => {
  const { source } = await readFile('./fixtures/codegen/unhanding.json')
  const { code, map } = generate(source, {
    sourceMap: true,
    env: 'development',
    forceStringify: true
  })

  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('complex', async () => {
  const { source } = await readFile('./fixtures/codegen/complex.json')
  const { code, map } = generate(source, {
    sourceMap: true,
    env: 'development'
  })

  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('bare', async () => {
  const { source } = await readFile('./fixtures/bare.json')
  const { code, map } = generate(source, {
    type: 'bare',
    sourceMap: true,
    env: 'development'
  })

  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('legacy', async () => {
  const { source } = await readFile('./fixtures/codegen/complex.json')
  const { code, map } = generate(source, {
    type: 'sfc',
    legacy: true,
    sourceMap: true
  })

  expect(validateSyntax(code)).toBe(true)
  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('bridge', async () => {
  const { source } = await readFile('./fixtures/codegen/complex.json')
  const { code, map } = generate(
    source,
    {
      type: 'sfc',
      bridge: true,
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

  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('bridge with ESM exporting', async () => {
  const { source } = await readFile('./fixtures/codegen/complex.json')
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
      return source
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
        .replace(/\\/g, '\\\\')
        .replace(/\u0027/g, '\\u0027')
    }
  )

  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('useClassComponent', async () => {
  const { source } = await readFile('./fixtures/codegen/complex.json')
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
  expect(code).toContain('Component.__o || Component.__vccOpts || Component')
  expect(code).toContain('_Component.__i18n')
  expect(map).toMatchSnapshot('map')
})

test('array basic', async () => {
  const { source } = await readFile('./fixtures/codegen/array-basic.json')
  const { code, map } = generate(source, {
    type: 'sfc',
    sourceMap: true,
    env: 'development'
  })

  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('array mixed', async () => {
  const { source } = await readFile('./fixtures/codegen/array-mix.json')
  const { code, map } = generate(source, {
    type: 'sfc',
    sourceMap: true,
    env: 'development'
  })

  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('invalid message syntax', async () => {
  const { source } = await readFile('./fixtures/codegen/invalid-message.json')
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
  const { source } = await readFile('./fixtures/codegen/html.json')
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
