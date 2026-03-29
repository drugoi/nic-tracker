#!/usr/bin/env bash
set -euo pipefail
export NVM_CI=1
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck source=/dev/null
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  . "$NVM_DIR/nvm.sh"
fi

if [[ -f .nvmrc ]] && [[ -s "$NVM_DIR/nvm.sh" ]]; then
  nvm install
  nvm use --silent
fi

pm2 delete nic-bot 2>/dev/null || true
pm2 start "$ROOT/ecosystem.config.cjs"
pm2 save
