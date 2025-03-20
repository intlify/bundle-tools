import { bundleAndRun } from './utils'

const values = {
  a: 1,
  b: 'hello',
  c: {
    a: 1,
    nest: {
      foo: 'hello'
    }
  },
  d: () => {
    return 'hello'
  }
}

test('basic', async () => {
  const { module } = await bundleAndRun('./injections/basic.vue', {
    intlify: values
  })
  expect(module.a).toEqual(1)
  expect(module.b).toEqual('hello')
  expect(module.c.a).toEqual(1)
  expect(module.c.nest.foo).toEqual('hello')
  expect(module.d).toEqual('hello')
})
