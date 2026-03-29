#!/usr/bin/env bash
set -euo pipefail
export NVM_CI=1

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -n "${NIC_BOT_NODE:-}" ]]; then
  exec "${NIC_BOT_NODE}" "$ROOT/dist/index.js"
fi

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck source=/dev/null
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  . "$NVM_DIR/nvm.sh"
fi

if [[ -f "$ROOT/.nvmrc" ]] && [[ -s "$NVM_DIR/nvm.sh" ]]; then
  nvm install
  nvm use --silent
fi

exec node "$ROOT/dist/index.js"
