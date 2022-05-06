import { resolve } from 'pathe'
import { bundleVite, bundleAndRun } from '../utils'

describe('resource files', () => {
  const options = {
    sourcemap: true,
    target: './fixtures/locales/',
    include: [resolve(__dirname, '../fixtures/locales/**')]
  }

  test('json', async () => {
    const { map } = await bundleAndRun('ja.json', bundleVite, options)
    expect(map.mappings).toMatchSnapshot()
  })

  test('json5', async () => {
    const { map } = await bundleAndRun('en.json5', bundleVite, options)
    expect(map.mappings).toMatchSnapshot()
  })

  test('yaml', async () => {
    const { map } = await bundleAndRun('ko.yaml', bundleVite, options)
    expect(map.mappings).toMatchSnapshot()
  })
})

describe('custom blocks', () => {
  test('json', async () => {
    const { map } = await bundleAndRun('basic.vue', bundleVite, {
      sourcemap: true
    })
    expect(map.mappings).toMatchSnapshot()
  })

  test('yaml', async () => {
    const { map } = await bundleAndRun('yaml.vue', bundleVite, {
      sourcemap: true
    })
    expect(map.mappings).toMatchSnapshot()
  })

  test('yml', async () => {
    const { map } = await bundleAndRun('yml.vue', bundleVite, {
      sourcemap: true
    })
    expect(map.mappings).toMatchSnapshot()
  })

  test('json5', async () => {
    const { map } = await bundleAndRun('json5.vue', bundleVite, {
      sourcemap: true
    })
    expect(map.mappings).toMatchSnapshot()
  })
})
