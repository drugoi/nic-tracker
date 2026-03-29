## Learned User Preferences

- Server deploy should stay a simple `git pull` → `npm ci` → PM2 flow without a separate manual compile step in the deploy script (build runs via `postinstall`).

## Learned Workspace Facts

- TypeScript lives under `src/`; runtime entry is compiled output in `dist/`. `postinstall` runs `npm run build` so a clean `npm ci` produces `dist/`; `typescript` and needed `@types/*` are in `dependencies` so production installs can still compile when devDependencies are omitted.
- The `whois` npm package must stay pinned to exactly `2.14.2` (not a caret range); 2.15+ ship `import` syntax in `index.js` without `"type": "module"`, which breaks when the app uses `"type": "module"`.
- `src/polyfill-streams.ts` is loaded first from `src/index.ts` to set `ReadableStream` / `WritableStream` / `TransformStream` on `globalThis` when missing, avoiding undici-related crashes on older Node.
- `.nvmrc` pins the intended Node major line for the bot; `package.json` `engines.node` documents supported runtimes (>=18).
- PM2 + nvm: `ecosystem.config.cjs` should run `scripts/run-bot.sh` with `interpreter: /bin/bash` so `nvm` and `.nvmrc` apply before `exec node dist/index.js`; plain `interpreter: node` often resolves to an old Node on the daemon PATH. Optional override: `NIC_BOT_NODE` absolute path to `node`.
- `pm2 restart` does not pick up a new script path or interpreter; after changing PM2 config, run `npm run pm2:recreate` or `bash scripts/pm2-recreate.sh` once (delete + start from ecosystem + `pm2 save`).
