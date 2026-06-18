#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ LOOPER + NORTHPOLE setup"
echo "  project: $ROOT"

cd "$ROOT"
npm install
npm run seed
npm test

echo "✓ Ready. Run: npm run dev  →  unlock with 333333  →  /looper and /north-pole"