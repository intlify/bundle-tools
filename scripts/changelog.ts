import minimist from "minimist";
import path from "path";
import semver from "semver";
import { execute } from "./runner";
import {
  getIncrementer,
  getRelativePath,
  getRootPath,
  getTags,
  getTargetVersion,
  readPackageJson,
  renderChangelog,
  writeChangelog,
} from "./utils";

import type { Logger } from "./utils";

const args = minimist(process.argv.slice(2));
const isDryRun = args.dry;

async function generateChangelog(log: Logger) {
  const pkgDir = path.resolve(await getRootPath(), await getRelativePath());
  const pkgPath = path.resolve(pkgDir, "package.json");
  const pkg = await readPackageJson(pkgPath);
  if (pkg.private) {
    log(`${pkg.name} package is private! Stop to generate changelog !!`);
    return;
  }

  const pkgName = pkg.name.replace(/^@intlify\//, "");
  const currentVersion = pkg.version;
  const inc = getIncrementer(currentVersion);

  let targetVersion = args._[0];
  if (!targetVersion) {
    targetVersion = await getTargetVersion(currentVersion, inc);
  }
  if (!semver.valid(targetVersion)) {
    throw new Error(`invalid target version: ${targetVersion}`);
  }

  const { fromTag } = getTags(pkgName, currentVersion, targetVersion);
  const releaseVersion = `${pkg.name}@${targetVersion}`;

  log(`Starting ${pkg.name} package changelog generating ...`);
  const changelog = await renderChangelog(fromTag, releaseVersion, pkgName);
  console.log(`changelog: ${changelog}`);

  if (!isDryRun) {
    await writeChangelog(pkgDir, changelog, targetVersion);
  }
}

async function main() {
  await execute("changelog", generateChangelog);
}

main().catch((err) => {
  console.error(err);
});
