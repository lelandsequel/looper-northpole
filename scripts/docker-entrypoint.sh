#!/bin/sh
set -e

mkdir -p "$LOOPER_DATA_DIR"

if [ ! -f "$LOOPER_DATA_DIR/looper-northpole.db" ]; then
  echo "→ First boot — seeding portfolio into $LOOPER_DATA_DIR"
  NODE_PATH=/app/node_modules node scripts/seed.mjs
fi

echo "→ LOOPER starting on :${PORT:-3000} (data: $LOOPER_DATA_DIR)"
exec node server.js