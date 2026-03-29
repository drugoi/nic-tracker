#!/usr/bin/env bash
# PM2 runs this with interpreter=/bin/bash so nvm applies before Node starts.
# Plain `interpreter: node` uses whatever `node` PM2’s environment has (often 17.x).
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

echo "[nic-bot] node $(node -v) at $(command -v node)" >&2
exec node "$ROOT/dist/index.js"
