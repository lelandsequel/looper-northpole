#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PARENT="$(dirname "$ROOT")"

echo "→ LOOPER + NORTHPOLE setup"
echo "  project: $ROOT"

# Monorepo layout (sibling repos) — preferred for local dev
if [[ -d "$PARENT/luna" && -d "$PARENT/strata-v1" ]]; then
  echo "→ Found sibling repos (luna, strata-v1) — using file: deps"
  cd "$ROOT"
  npm install
else
  echo "→ Standalone clone — installing from GitHub (luna-engine, strata-v1)"
  cd "$ROOT"
  npm install
fi

echo "→ Seeding initiative queue"
npm run seed

echo "→ Running tests"
npm test

echo "✓ Ready. Run: npm run dev  →  unlock with 333333  →  /looper and /north-pole"