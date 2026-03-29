/**
 * PM2: runs `scripts/run-bot.sh` under bash so `nvm use` / `.nvmrc` apply before Node.
 * Do not use `interpreter: node` + `script: dist/index.js` with nvm — PM2 keeps Node 17 on PATH.
 *
 * First-time / after changing PM2 config:
 *   bash scripts/pm2-recreate.sh
 *
 * Override Node binary: env NIC_BOT_NODE=/full/path/to/node (optional).
 */
const { join } = require('node:path');

module.exports = {
  apps: [
    {
      name: 'nic-bot',
      script: join(__dirname, 'scripts/run-bot.sh'),
      cwd: __dirname,
      interpreter: '/bin/bash',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
