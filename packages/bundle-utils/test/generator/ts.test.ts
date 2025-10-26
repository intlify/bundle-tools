import { generate } from '../../src/ts'
import { readFile, validateSyntax } from '../utils'

test('simple', async () => {
  const { source } = await readFile('./fixtures/codegen/simple.ts')
  const { code } = generate(source, {
    sourceMap: true,
    env: 'development'
  })

  expect(validateSyntax(code)).toBe(true)
  expect(code).toMatchInlineSnapshot(`
    "const resource = {
      "hi": (()=>{const fn=(ctx) => {const { normalize: _normalize } = ctx;return _normalize(["hi there!"])};fn.source="hi there!";return fn;})(),
      "hello": (()=>{const fn=(ctx) => {const { normalize: _normalize } = ctx;return _normalize(["hello world!"])};fn.source="hello world!";return fn;})(),
      "named": (()=>{const fn=(ctx) => {const { normalize: _normalize, interpolate: _interpolate, named: _named } = ctx;return _normalize(["hi, ", _interpolate(_named("name")), " !"])};fn.source="hi, {name} !";return fn;})(),
      "list": (()=>{const fn=(ctx) => {const { normalize: _normalize, interpolate: _interpolate, list: _list } = ctx;return _normalize(["hi, ", _interpolate(_list(0)), " !"])};fn.source="hi, {0} !";return fn;})(),
      "literal": (()=>{const fn=(ctx) => {const { normalize: _normalize } = ctx;return _normalize(["hi, ", "kazupon", " !"])};fn.source="hi, {  'kazupon'  } !";return fn;})(),
      "linked": (()=>{const fn=(ctx) => {const { normalize: _normalize, linked: _linked, type: _type } = ctx;return _normalize(["hi, ", _linked("name", undefined, _type), " !"])};fn.source="hi, @:name !";return fn;})(),
      "plural": (()=>{const fn=(ctx) => {const { normalize: _normalize, linked: _linked, type: _type, interpolate: _interpolate, list: _list, named: _named, plural: _plural } = ctx;return _plural([_normalize([_linked("no apples", "caml", _type)]), _normalize([_interpolate(_list(0)), " apple"]), _normalize([_interpolate(_named("n")), " apples"])])};fn.source="@.caml:{'no apples'} | {0} apple | {n} apples";return fn;})()
    }
    export default resource"
  `)
})
