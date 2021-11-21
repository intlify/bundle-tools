import path from 'path'
import { bundleAndRun } from './utils'

describe('resource files', () => {
  const options = {
    sourcemap: true,
    target: './fixtures/locales/',
    include: [path.resolve(__dirname, './fixtures/locales/**')]
  }

  test('json', async () => {
    const { map } = await bundleAndRun('ja.json', options)
    expect(map.mappings).toMatchSnapshot()
  })

  test('json5', async () => {
    const { map } = await bundleAndRun('en.json5', options)
    expect(map.mappings).toMatchSnapshot()
  })

  test('yaml', async () => {
    const { map } = await bundleAndRun('ko.yaml', options)
    expect(map.mappings).toMatchSnapshot()
  })
})

describe('custom blocks', () => {
  test('json', async () => {
    const { map } = await bundleAndRun('basic.vue', { sourcemap: true })
    expect(map.mappings).toMatchSnapshot()
  })

  test('yaml', async () => {
    const { map } = await bundleAndRun('yaml.vue', { sourcemap: true })
    expect(map.mappings).toMatchSnapshot()
  })

  test('yml', async () => {
    const { map } = await bundleAndRun('yml.vue', { sourcemap: true })
    expect(map.mappings).toMatchSnapshot()
  })

  test('json5', async () => {
    const { map } = await bundleAndRun('json5.vue', { sourcemap: true })
    expect(map.mappings).toMatchSnapshot()
  })
})
