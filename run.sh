#!/usr/bin/env bash
# Starts the travel planner. Usage: ./run.sh [dev|mock|prod|check|test]
set -eu
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.13 or newer is required. Install the LTS version from https://nodejs.org" >&2
  exit 1
fi

if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=13)?0:1)'; then
  echo "Node.js $(node -v) is too old. Install 22.13 or newer (LTS) from https://nodejs.org" >&2
  exit 1
fi

exec node scripts/run.mjs "$@"
