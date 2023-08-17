import { readFile, validateSyntax } from '../utils'
import { generate } from '../../src/js'

test('import', async () => {
  const { source } = await readFile('./fixtures/codegen/import.js')
  const { code, map } = generate(source, {
    sourceMap: true,
    env: 'development'
  })

  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})
