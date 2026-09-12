#!/usr/bin/env bash
# Fails if package.json's packageManager or the Dockerfile's oven/bun base-image tags
# drift from the bun version pinned in mise.toml (the single source of truth).
set -euo pipefail

expected="$(scripts/mise-tool-version.sh bun)"
status=0

pm_version="$(grep -oE '"packageManager": "bun@[^"]+"' package.json | sed -E 's/.*bun@([^"]+)"/\1/')"
if [ "$pm_version" != "$expected" ]; then
  echo "::error file=package.json::packageManager pins bun@$pm_version, mise.toml pins bun $expected"
  status=1
fi

while IFS= read -r v; do
  if [ "$v" != "$expected" ]; then
    echo "::error file=Dockerfile::FROM oven/bun:$v does not match mise.toml's pinned $expected"
    status=1
  fi
done <<< "$(grep -oE 'FROM oven/bun:[^ ]+' Dockerfile | sed -E 's#FROM oven/bun:##' | sort -u)"

exit $status
