import { readFile } from '../utils'
import { generate } from '../../src/json'

test('json5', async () => {
  const { source } = await readFile('./fixtures/codegen/complex.json5')
  const { code, map } = generate(source, {
    sourceMap: true,
    env: 'development'
  })

  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})

test('AST code generation', async () => {
  const { source } = await readFile('./fixtures/codegen/complex.json5')
  const { code } = generate(source, {
    jit: true,
    env: 'production'
  })

  expect(code).toMatchSnapshot('code')
})
