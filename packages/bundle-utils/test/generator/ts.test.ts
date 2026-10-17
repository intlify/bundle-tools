import { validateSyntax } from '../utils'
import { generate } from '../../src/ts'

// a custom block of an SFC has the filename of the SFC, not of a `.ts` file
test('TypeScript in a source whose filename does not end with .ts', async () => {
  const { code } = await generate(`export default { hello: 'hello' } as const`, {
    filename: '/path/to/App.vue',
    env: 'development'
  })
  expect(validateSyntax(code)).toBe(true)
  expect(code).toContain('"hello"')
})
