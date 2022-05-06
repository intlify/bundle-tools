import { resolve } from 'pathe'
import { bundleWebpack, bundleAndRun } from '../utils'

const options = {
  sourcemap: true,
  target: './fixtures/locales/',
  include: [resolve(__dirname, '../fixtures/locales/**')]
}

test('resource files: json', async () => {
  const { map } = await bundleAndRun('ja.json', bundleWebpack, options)
  expect(map.mappings).toMatchSnapshot()
})

test('resource files: json5', async () => {
  const { map } = await bundleAndRun('en.json5', bundleWebpack, options)
  expect(map.mappings).toMatchSnapshot()
})

test('resource files: yaml', async () => {
  const { map } = await bundleAndRun('ko.yaml', bundleWebpack, options)
  expect(map.mappings).toMatchSnapshot()
})

test('custom blocks: json', async () => {
  const { map } = await bundleAndRun('basic.vue', bundleWebpack, {
    sourcemap: true
  })
  expect(map.mappings).toMatchSnapshot()
})

test('custom blocks: yaml', async () => {
  const { map } = await bundleAndRun('yaml.vue', bundleWebpack, {
    sourcemap: true
  })
  expect(map.mappings).toMatchSnapshot()
})

test('custom blocks: yml', async () => {
  const { map } = await bundleAndRun('yml.vue', bundleWebpack, {
    sourcemap: true
  })
  expect(map.mappings).toMatchSnapshot()
})

test('custom blocks: json5', async () => {
  const { map } = await bundleAndRun('json5.vue', bundleWebpack, {
    sourcemap: true
  })
  expect(map.mappings).toMatchSnapshot()
})
