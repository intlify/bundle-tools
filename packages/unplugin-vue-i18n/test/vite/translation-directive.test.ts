import fg from 'fast-glob'
import path from 'node:path'
import { bundleVite, bundleAndRun } from '../utils'

describe('translation directive', async () => {
  const fixtures = await fg(
    path.resolve(__dirname, '../fixtures/directives/*.vue')
  )
  fixtures.forEach(fixture => {
    const filename = path.basename(fixture)
    const basename = filename.replace(/\.vue$/, '')
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
