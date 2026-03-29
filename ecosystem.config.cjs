/**
 * PM2 entry for production. After `npm ci`, `postinstall` runs `npm run build`
 * and produces `dist/`.
 *
 * Node binary: PM2 uses whatever `node` is on PATH when the *PM2 daemon* started,
 * which is often still an old nvm default (e.g. 17.x). This config prefers:
 *   1. env NIC_BOT_NODE — absolute path to `node` (e.g. nvm’s Node 22)
 *   2. nvm’s default alias (~/.nvm/alias/default → versions/node/<ver>/bin/node)
 *   3. `node` on PATH
 *
 * To use Node 22 everywhere: `nvm alias default 22`, then `pm2 kill` and
 * `pm2 start ecosystem.config.cjs` from a shell where `node -v` is 22, then `pm2 save`.
 */
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

function nvmDefaultNodeBin() {
  const home = process.env.HOME;
  if (!home) {
    return null;
  }
  try {
    const verPath = join(home, '.nvm/alias/default');
    if (!existsSync(verPath)) {
      return null;
    }
    const ver = readFileSync(verPath, 'utf8').trim();
    if (!ver) {
      return null;
    }
    const bin = join(home, '.nvm/versions/node', ver, 'bin/node');
    return existsSync(bin) ? bin : null;
  } catch {
    return null;
  }
}

const interpreter = process.env.NIC_BOT_NODE || nvmDefaultNodeBin() || 'node';

module.exports = {
  apps: [
    {
      name: 'nic-bot',
      script: 'dist/index.js',
      cwd: __dirname,
      interpreter,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
