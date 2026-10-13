import { expect, test } from 'vitest'
import { bundleAndRun, bundleWebpack } from '../utils'

test('empty i18n custom block is treated as an empty object', async () => {
  const { module } = await bundleAndRun('root-empty.vue', bundleWebpack)
  expect(module.__i18n.pop().resource).toEqual({})
})

test('array i18n custom block fails the build with the file name', async () => {
  await expect(bundleAndRun('root-array.vue', bundleWebpack)).rejects.toThrowError(
    /but got an array in the i18n custom block of .*root-array\.vue/
  )
})
