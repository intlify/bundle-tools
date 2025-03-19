import { generate } from '../../src/js'

test('import', async () => {
  const { code } = generate(
    `
export default {
  test: "hello",
  test2: 123,
  hello: /abc/,
}
`,
    {
      sourceMap: true,
      env: 'development'
    }
  )

  expect(code).toMatchInlineSnapshot(`
    "const resource = {
      "test": (()=>{const fn=(ctx) => {const { normalize: _normalize } = ctx;return _normalize(["hello"])};fn.source="hello";return fn;})(),
      "test2": 123,
      
    }
    export default resource"
  `)
})
