import path from 'path'
import fs from 'fs/promises'
import minimist from 'minimist'
import semver from 'semver'
import prompts from 'prompts'
import chalk from 'chalk'
import { Octokit } from '@octokit/rest'
import {
  run,
  getRootPath,
  getRelativePath,
  readPackageJson,
  getRepoName,
  getTags,
  getIncrementer,
  getTargetVersion,
  renderChangelog,
  writeChangelog
} from './utils'
import { execute } from './runner'

import type { PackageJson, Logger } from './utils'

const args = minimist(process.argv.slice(2))
const isDryRun = args.dry
const skipBuild = args.skipBuild
const skipChangelog = args.skipChangelog

const dryRun = (bin, args, opts = {}) =>
  console.log(chalk.yellow(`[dryrun] ${bin} ${args.join(' ')}`), opts)
const runIfNotDry = isDryRun ? dryRun : run

async function releasePackage(log: Logger) {
  const pkgDir = path.resolve(await getRootPath(), await getRelativePath())
  const pkgPath = path.resolve(pkgDir, 'package.json')

  const pkg = await readPackageJson(pkgPath)
  if (pkg.private) {
    log(`${pkg.name} package is private! Stop to release!!`)
    return
  }

  const pkgName = pkg.name.replace(/^@intlify\//, '')
  const currentVersion = pkg.version
  const inc = getIncrementer(currentVersion)

  log(`Starting ${pkg.name} package release...`)
  let targetVersion = args._[0]
  if (!targetVersion) {
    targetVersion = await getTargetVersion(currentVersion, inc)
  }
  if (!semver.valid(targetVersion)) {
    throw new Error(`invalid target version: ${targetVersion}`)
  }

  if (targetVersion.includes('beta') && !args.tag) {
    const { tagBeta } = await prompts({
      type: 'confirm',
      name: 'tagBeta',
      message: `Publish under dist-tag "beta"?`
    })

    if (tagBeta) {
      args.tag = 'beta'
    }
  }

  const { tag, fromTag } = getTags(pkgName, currentVersion, targetVersion)
  const releaseVersion = `${pkg.name}@${targetVersion}`
  if (!(await confirmRelease(tag, releaseVersion))) {
    return
  }

  log('Updating package version...')
  if (!isDryRun) {
    updateVersion(targetVersion, pkg, pkgPath)
  }

  log('Building package...')
  if (!skipBuild && !isDryRun) {
    await run('yarn', ['build'])
  } else {
    console.log(`(skipped)`)
  }

  log('Generating changelog...')
  let changelog: string | null = null
  if (!skipChangelog) {
    changelog = await renderChangelog(fromTag, releaseVersion, pkgName)
    if (!isDryRun) {
      await writeChangelog(pkgDir, changelog, targetVersion)
    } else {
      console.log(`changelog: ${changelog}`)
    }
  } else {
    console.log(`(skipped)`)
  }

  const { stdout } = await run('git', ['diff'], { stdio: 'pipe' })
  if (stdout) {
    log('Committing changes...')
    await runIfNotDry('git', ['add', '-A'])
    await runIfNotDry('git', ['commit', '-m', `release: ${tag}`])
  } else {
    console.log('No changes to commit.')
  }

  log('Publishing package...')
  await publishPackage(targetVersion, pkgName, runIfNotDry)

  log('Pushing tag to GitHub...')
  await runIfNotDry('git', ['tag', tag])
  await runIfNotDry('git', ['push', 'origin', `refs/tags/${tag}`])
  await runIfNotDry('git', ['push'])

  log('Releasing to GitHub Releases...')
  if (!skipChangelog && !isDryRun) {
    await releaseGitHub(
      tag,
      releaseVersion,
      changelog,
      isPrelease(targetVersion)
    )
  } else {
    console.log(`(skipped)`)
  }

  if (isDryRun) {
    console.log(`Dry run finished - run git diff to see package changes.`)
  }
}

async function confirmRelease(
  tag: string,
  releaseVersion: string
): Promise<boolean> {
  const { yes } = await prompts({
    type: 'confirm',
    name: 'yes',
    message: `Releasing with release: ${releaseVersion}, tag: ${tag}. Confirm?`
  })
  return yes as boolean
}

async function updateVersion(
  version: string,
  pkg: PackageJson,
  pkgPath: string
) {
  pkg.version = version
  return await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

async function publishPackage(version: string, pkgName: string, runIfNotDry) {
  const publicArgs = [
    'publish',
    '--no-git-tag-version',
    '--new-version',
    version,
    '--access',
    'public'
  ]
  if (args.tag) {
    publicArgs.push(`--tag`, args.tag)
  }
  try {
    await runIfNotDry('yarn', publicArgs)
    console.log(chalk.green(`Successfully published ${pkgName}@${version}`))
  } catch (e) {
    console.error(e)
    if (e.stderr.match(/previously published/)) {
      console.log(chalk.red(`Skipping already published: ${pkgName}`))
    } else {
      throw e
    }
  }
}

function isPrelease(version: string) {
  return (
    version.includes('beta') ||
    version.includes('alpha') ||
    version.includes('rc')
  )
}

async function releaseGitHub(
  tag: string,
  releaseName: string,
  content = '',
  prerelease = false
) {
  const octokit = new Octokit({
    auth: process.env.GITHUB_AUTH || ''
  })
  const { data: user } = await octokit.request('GET /user')
  const repo = await getRepoName()

  return await octokit.repos.createRelease({
    owner: user.login,
    repo,
    tag_name: tag,
    name: releaseName,
    body: content,
    prerelease
  })
}

async function main(): Promise<void> {
  await execute('release', releasePackage)
}

main().catch(err => {
  console.error(err)
})
