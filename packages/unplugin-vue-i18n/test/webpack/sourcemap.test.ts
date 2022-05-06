import { resolve } from 'pathe'
import { bundleWebpack, bundleAndRun } from '../utils'

describe('resource files', () => {
  const options = {
    sourcemap: true,
    target: './fixtures/locales/',
    include: [resolve(__dirname, '../fixtures/locales/**')]
  }

  test('json', async () => {
    const { map } = await bundleAndRun('ja.json', bundleWebpack, options)
    expect(map.mappings).toMatchSnapshot()
  })

  test('json5', async () => {
    const { map } = await bundleAndRun('en.json5', bundleWebpack, options)
    expect(map.mappings).toMatchSnapshot()
  })

  test('yaml', async () => {
    const { map } = await bundleAndRun('ko.yaml', bundleWebpack, options)
    expect(map.mappings).toMatchSnapshot()
  })
})

describe('custom blocks', () => {
  test('json', async () => {
    const { map } = await bundleAndRun('basic.vue', bundleWebpack, {
      sourcemap: true
    })
    expect(map.mappings).toMatchSnapshot()
  })

  test('yaml', async () => {
    const { map } = await bundleAndRun('yaml.vue', bundleWebpack, {
      sourcemap: true
    })
    expect(map.mappings).toMatchSnapshot()
  })

  test('yml', async () => {
    const { map } = await bundleAndRun('yml.vue', bundleWebpack, {
      sourcemap: true
    })
    expect(map.mappings).toMatchSnapshot()
  })

  test('json5', async () => {
    const { map } = await bundleAndRun('json5.vue', bundleWebpack, {
      sourcemap: true
    })
    expect(map.mappings).toMatchSnapshot()
  })
})
