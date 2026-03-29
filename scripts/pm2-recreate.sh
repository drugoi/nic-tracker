#!/usr/bin/env bash
# Recreate the nic-bot PM2 process so ecosystem.config.cjs (Node from .nvmrc) is applied.
# `pm2 restart` keeps the old script path and interpreter — you must delete + start once.
set -euo pipefail
export NVM_CI=1
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck source=/dev/null
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  . "$NVM_DIR/nvm.sh"
fi

if [[ -f .nvmrc ]]; then
  nvm use
fi

echo "Shell sees node (before nvm): $(command -v node 2>/dev/null || echo none) ($(node -v 2>/dev/null || echo n/a))"
if [[ -f .nvmrc ]] && [[ -s "$NVM_DIR/nvm.sh" ]]; then
  nvm install
  nvm use --silent
fi
echo "After nvm use: $(command -v node) ($(node -v))"

pm2 delete nic-bot 2>/dev/null || true
pm2 start "$ROOT/ecosystem.config.cjs"
pm2 save

echo "--- pm2 describe nic-bot (first lines) ---"
pm2 describe nic-bot | head -25
