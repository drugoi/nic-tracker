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
