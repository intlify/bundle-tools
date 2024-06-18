import { parseVueRequest } from '../src/vue'

test('parse', () => {
  const id =
    'src/components/HelloI18n.vue?vue&type=custom&blockType=i18n&src=true&raw=true&locale=en&global=true&index=1&lang.json'
  const result = parseVueRequest(id)
  expect(result.filename).toEqual('src/components/HelloI18n.vue')
  expect(result.query.index).toEqual(1)
  expect(result.query.type).toEqual('custom')
  expect(result.query.blockType).toEqual('i18n')
  expect(result.query.locale).toEqual('en')
  expect(result.query.lang).toEqual('json')
  expect(result.query.vue).toEqual(true)
  expect(result.query.global).toEqual(true)
  expect(result.query.src).toEqual(true)
  expect(result.query.raw).toEqual(true)
})
