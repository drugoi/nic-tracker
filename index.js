/**
 * PM2 / legacy entry: keep `script: .../index.js` working after the TypeScript move.
 * The real code is compiled to `dist/` — created by `npm run build` or `postinstall` after `npm ci`.
 */
import './dist/index.js';
