import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { bundleAndRun, bundleWebpack } from '../utils'

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
;[
  {
    subject: 'custom blocks: json',
    test: async () => {
      const { map } = await bundleAndRun('basic.vue', bundleWebpack, {
        sourcemap: true
      })
      expect(map.mappings).toMatchSnapshot()
    }
  },
  {
    subject: 'custom blocks: yaml',
    test: async () => {
      const { map } = await bundleAndRun('yaml.vue', bundleWebpack, {
        sourcemap: true
      })
      expect(map.mappings).toMatchSnapshot()
    }
  },
  {
    subject: 'custom blocks: yml',
    test: async () => {
      const { map } = await bundleAndRun('yml.vue', bundleWebpack, {
        sourcemap: true
      })
      expect(map.mappings).toMatchSnapshot()
    }
  },
  {
    subject: 'custom blocks: json5',
    test: async () => {
      const { map } = await bundleAndRun('json5.vue', bundleWebpack, {
        sourcemap: true
      })
      expect(map.mappings).toMatchSnapshot()
    }
  }
].forEach(item => {
  const _test = process.env.CI ? test : test.skip
  _test(item.subject, item.test)
})
