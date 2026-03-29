/**
 * PM2 entry for production. After `npm ci`, `postinstall` runs `npm run build`
 * and produces `dist/`.
 *
 * IMPORTANT: `pm2 restart nic-bot` does NOT reload this file. If `pm2 describe`
 * still shows script `index.js` and Node 17, run once from the repo:
 *   bash scripts/pm2-recreate.sh
 *
 * Node binary resolution order:
 *   1. env NIC_BOT_NODE — absolute path to `node`
 *   2. .nvmrc in this repo → ~/.nvm/versions/node/<matching install>/bin/node
 *   3. nvm default alias (~/.nvm/alias/default)
 *   4. `node` on PATH (often wrong: PM2 daemon’s old PATH)
 */
const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const PROJECT_ROOT = __dirname;

function readNvmrcVersion() {
  const nvmrc = join(PROJECT_ROOT, '.nvmrc');
  if (!existsSync(nvmrc)) {
    return null;
  }
  const line = readFileSync(nvmrc, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#'));
  if (!line) {
    return null;
  }
  return line.replace(/^v/, '');
}

function cmpSemver(a, b) {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < n; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) {
      return da - db;
    }
  }
  return 0;
}

function pickNvmDir(dirs, requested) {
  const norm = (d) => d.replace(/^v/, '');
  const exact = dirs.find((d) => norm(d) === requested);
  if (exact) {
    return exact;
  }
  const major = requested.split('.')[0];
  if (!/^\d+$/.test(major)) {
    return null;
  }
  const sameMajor = dirs.filter((d) => norm(d).split('.')[0] === major);
  if (sameMajor.length === 0) {
    return null;
  }
  return sameMajor.sort((a, b) => cmpSemver(norm(b), norm(a)))[0];
}

function nodeFromNvmrc() {
  const home = process.env.HOME;
  if (!home) {
    return null;
  }
  const requested = readNvmrcVersion();
  if (!requested || /[*/]/.test(requested)) {
    return null;
  }
  const base = join(home, '.nvm/versions/node');
  if (!existsSync(base)) {
    return null;
  }
  const dirs = readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const picked = pickNvmDir(dirs, requested);
  if (!picked) {
    return null;
  }
  const bin = join(base, picked, 'bin/node');
  return existsSync(bin) ? bin : null;
}

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

const interpreter =
  process.env.NIC_BOT_NODE || nodeFromNvmrc() || nvmDefaultNodeBin() || 'node';

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
