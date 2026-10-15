import path from 'node:path'
import { glob } from 'tinyglobby'
import { describe, expect, test } from 'vitest'
import { bundleAndRun, bundleVite } from '../utils'

describe('translation directive', async () => {
  const fixtures = await glob(path.resolve(__dirname, '../fixtures/directives/*.vue'), {
    expandDirectories: false
  })
  fixtures.forEach(fixture => {
    const filename = path.basename(fixture)
    const basename = filename.replace(/\.vue$/, '')
    // eslint-disable-next-line vitest/valid-title -- ignore
    test(basename, async () => {
      const options = {
        target: './fixtures/directives/',
        optimizeTranslationDirective: true
      }
      const mod = await bundleAndRun(filename, bundleVite, options)
      const renderString = mod.module.render.toString() as string
      expect(renderString).toMatchSnapshot()
    })
  })
})
