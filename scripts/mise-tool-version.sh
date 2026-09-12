#!/usr/bin/env bash
# Prints the version pinned for <tool> in mise.toml's [tools] table.
# Usage: scripts/mise-tool-version.sh bun
set -euo pipefail
grep -E "^${1} = " mise.toml | head -n1 | sed -E 's/^[a-z]+ = "([^"]+)"/\1/'
