/**
 * PM2 entry for production. After `npm ci`, `postinstall` runs `npm run build`
 * and produces `dist/`. Point the app at `dist/index.js` (not the old root `index.js`).
 *
 * Usage: pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'nic-bot',
      script: 'dist/index.js',
      cwd: __dirname,
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
