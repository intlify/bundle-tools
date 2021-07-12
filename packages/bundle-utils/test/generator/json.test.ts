import { readFile } from '../utils'
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
