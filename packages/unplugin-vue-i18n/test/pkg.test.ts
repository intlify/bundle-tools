import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'
import { promises as fs } from 'node:fs'
import { resolvePackageJSON } from '../src/utils'

const fixtureDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/packages'
)
const resolveFixture = (...p: string[]) => resolve(fixtureDir, ...p)

async function readJSON(file: string) {
  return JSON.parse(await fs.readFile(file, 'utf-8')) as { name: string }
}

describe('resolvePackageJSON', () => {
  test('in current', async () => {
    const { name } = await readJSON(
      await resolvePackageJSON(resolveFixture('.'))
    )
    expect(name).toEqual('root')
  })

  test('in pkg1', async () => {
    const { name } = await readJSON(
      await resolvePackageJSON(resolveFixture('./pkg1'))
    )
    expect(name).toEqual('pkg1')
  })

  test('do not have package.json', async () => {
    const { name } = await readJSON(
      await resolvePackageJSON(resolveFixture('./no-pkg'))
    )
    expect(name).toEqual('root')
  })
})
