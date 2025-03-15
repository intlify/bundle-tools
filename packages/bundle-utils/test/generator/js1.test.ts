import { readFile } from '../utils'
import { generate, initParser } from '../../src/js'
import { beforeAll } from 'vitest'

beforeAll(async () => {
  await initParser()
})

test('import', async () => {
  const { source } = await readFile('./fixtures/codegen/import.js')
  const { code, map } = generate(source, {
    sourceMap: true,
    env: 'development'
  })

  expect(code).toMatchSnapshot('code')
  expect(map).toMatchSnapshot('map')
})
