#!/bin/bash

set -e

# Restore all git changes
git restore -s@ -SW  -- packages

# Build
pnpm build

# Release packages
for PKG in packages/* ; do
  if [[ -d $PKG ]]; then
    pushd $PKG
    TAG="beta"
    echo "⚡ Publishing $PKG with tag $TAG"
    pnpm publish --access public --no-git-checks --tag $TAG
    popd > /dev/null
  fi
done
