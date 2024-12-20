import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { bundleVite, bundleAndRun } from '../utils'
/**
 * TODO:
 *  custom blocks source map cannot confirm fully supporting
 *  because, seem that vite does not support source map for custom blocks...
 */

const options = {
  sourcemap: true,
  target: './fixtures/locales/',
  include: [resolve(__dirname, '../fixtures/locales/**')]
}

test('resource files: json', async () => {
  const { map } = await bundleAndRun('ja.json', bundleVite, options)
  expect(map.mappings).toMatchSnapshot()
})

test('resource files: json5', async () => {
  const { map } = await bundleAndRun('en.json5', bundleVite, options)
  expect(map.mappings).toMatchSnapshot()
})

test('resource files: yaml', async () => {
  const { map } = await bundleAndRun('ko.yaml', bundleVite, options)
  expect(map.mappings).toMatchSnapshot()
})

test('custom blocks: json', async () => {
  const { map } = await bundleAndRun('basic.vue', bundleVite, {
    sourcemap: true
  })
  expect(map.mappings).toMatchSnapshot()
})

test('custom blocks: yaml', async () => {
  const { map } = await bundleAndRun('yaml.vue', bundleVite, {
    sourcemap: true
  })
  expect(map.mappings).toMatchSnapshot()
})

test('custom blocks: yml', async () => {
  const { map } = await bundleAndRun('yml.vue', bundleVite, {
    sourcemap: true
  })
  expect(map.mappings).toMatchSnapshot()
})

test('custom blocks: json5', async () => {
  const { map } = await bundleAndRun('json5.vue', bundleVite, {
    sourcemap: true
  })
  expect(map.mappings).toMatchSnapshot()
})
