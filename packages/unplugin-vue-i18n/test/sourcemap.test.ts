import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { bundleAndRun, getCurrentTestBundler, isTestFramework } from './utils'
/**
 * TODO:
 *  custom blocks source map cannot confirm fully supporting
 *  because, seem that vite does not support source map for custom blocks...
 */

const options = {
  sourcemap: true,
  target: './fixtures/locales/',
  include: [resolve(__dirname, './fixtures/locales/**')]
}

const bundler = getCurrentTestBundler()

test('resource files: json', async () => {
  const { map } = await bundleAndRun('ja.json', bundler, options)
  expect(map.mappings).toMatchSnapshot()
})

test('resource files: json5', async () => {
  const { map } = await bundleAndRun('en.json5', bundler, options)
  expect(map.mappings).toMatchSnapshot()
})

test('resource files: yaml', async () => {
  const { map } = await bundleAndRun('ko.yaml', bundler, options)
  expect(map.mappings).toMatchSnapshot()
})

test.skipIf(!isTestFramework('vite'))('custom blocks: json', async () => {
  const { map } = await bundleAndRun('basic.vue', bundler, {
    sourcemap: true
  })
  expect(map.mappings).toMatchSnapshot()
})

test.skipIf(!isTestFramework('vite'))('custom blocks: yaml', async () => {
  const { map } = await bundleAndRun('yaml.vue', bundler, {
    sourcemap: true
  })
  expect(map.mappings).toMatchSnapshot()
})

test.skipIf(!isTestFramework('vite'))('custom blocks: yml', async () => {
  const { map } = await bundleAndRun('yml.vue', bundler, {
    sourcemap: true
  })
  expect(map.mappings).toMatchSnapshot()
})

test.skipIf(!isTestFramework('vite'))('custom blocks: json5', async () => {
  const { map } = await bundleAndRun('json5.vue', bundler, {
    sourcemap: true
  })
  expect(map.mappings).toMatchSnapshot()
})
