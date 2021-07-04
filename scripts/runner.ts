import path from 'path'
import chalk from 'chalk'
import glob from 'tiny-glob'
import prompts from 'prompts'
import { getRootPath, getRelativePath, readPackageJson } from './utils'

export type CommandType = 'release' | 'changelog'
export type Command = (log: Logger) => Promise<void>

import type { Mode, Logger } from './utils'

async function confirmBatchMode(type: CommandType): Promise<boolean> {
  const { yes } = await prompts({
    type: 'confirm',
    name: 'yes',
    message: `Are you sure to ${type} with batch mode?`
  })
  return yes as boolean
}

export async function execute(type: CommandType, command: Command) {
  const rootDir = await getRootPath()
  const pkgDir = path.resolve(rootDir, await getRelativePath())

  let mode: Mode = 'single'
  if (rootDir === pkgDir) {
    mode = 'batch'
  }
  const log = (...args) => {
    const ch =
      mode === 'single' ? chalk.black.bgGreenBright : chalk.black.bgYellowBright
    console.log(ch.bold(` ${mode} mode `), '', chalk.cyan(...args))
  }

  if (mode === 'batch') {
    log(`'${type}' confirm`)
    if (!(await confirmBatchMode(type))) {
      return
    }
    const pkgPath = path.resolve(pkgDir, 'package.json')
    const pkg = await readPackageJson(pkgPath)
    if (!pkg.workspaces) {
      return
    }
    for (const workspace of pkg.workspaces) {
      const packages = await glob(workspace)
      for (const p of packages) {
        const org = process.cwd()
        process.chdir(`${rootDir}/${p}`)
        await command(log)
        process.chdir(org)
      }
    }
  } else {
    await command(log)
  }
}
