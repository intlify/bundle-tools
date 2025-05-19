import { generate } from '../../src/yaml'
import { readFile } from '../utils'
;['yaml', 'yml'].forEach(format => {
  // eslint-disable-next-line vitest/valid-title
  test(format, async () => {
    const { source } = await readFile(`./fixtures/codegen/complex.${format}`)
    const { code, map } = generate(source, {
      sourceMap: true,
      env: 'development'
    })

    expect(code).toMatchSnapshot('code')
    expect(map).toMatchSnapshot('map')
  })
})

test('bare', async () => {
  const { source } = await readFile('./fixtures/bare.yaml')
  const { code, map } = generate(source, {
    type: 'bare',
    sourceMap: true,
    env: 'development'
  })

  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('array basic', async () => {
  const { source } = await readFile('./fixtures/codegen/array-basic.yml')
  const { code, map } = generate(source, {
    type: 'sfc',
    sourceMap: true,
    env: 'development'
  })

  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('array mixed', async () => {
  const { source } = await readFile('./fixtures/codegen/array-mix.yml')
  const { code, map } = generate(source, {
    type: 'sfc',
    sourceMap: true,
    env: 'development'
  })

  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('invalid message syntax', async () => {
  const { source } = await readFile('./fixtures/codegen/invalid-message.yml')

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
  const { source } = await readFile('./fixtures/codegen/html.yaml')

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

test('AST code generation', async () => {
  const { source } = await readFile(`./fixtures/codegen/complex.yaml`)
  const { code } = generate(source, {
    jit: true,
    env: 'production'
  })

  expect(code).toMatchSnapshot('code')
})
