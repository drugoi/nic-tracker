# Plan 007: Document setup and required environment variables

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c027afb..HEAD -- README.md .env.example src/env.ts package.json AGENTS.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `c027afb`, 2026-06-24

## Why this matters

The repo has required environment variables and a specific deploy model, but no
README or `.env.example`. New operators and future agents must read source code
or prior chat context to run the bot safely. A concise README and template
reduce setup mistakes without changing runtime behavior.

## Current state

Relevant files:

- `src/env.ts` is the source of truth for env vars.
- `package.json` lists commands.
- `AGENTS.md` records deploy/runtime preferences.
- No README or `.env.example` was present during the audit.

Current excerpts:

```ts
// src/env.ts:14-44
export const env = {
  get botToken(): string {
    return required('BOT_TOKEN');
  },
  get tgChannelId(): string {
    return required('TG_CHANNEL_ID');
  },
  get tgOwnerId(): string {
    return required('TG_OWNER_ID');
  },
  get dbHost(): string {
    return required('DB_HOST');
  },
  get dbName(): string {
    return required('DB_NAME');
  },
```

```json
// package.json:13-23
"scripts": {
  "build": "tsc -p tsconfig.build.json",
  "postinstall": "npm run build",
  "start": "node dist/index.js",
  "dev": "tsx watch src/index.ts",
  "whois": "node dist/whois-cli.js",
  "lint": "eslint src",
  "test": "vitest",
  "test:run": "vitest run",
  "pm2:recreate": "bash scripts/pm2-recreate.sh",
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:
- `README.md` (create)
- `.env.example` (create)
- `AGENTS.md` only if documenting a durable repo fact for future agents

**Out of scope**:
- Do not include real tokens, passwords, hostnames, or secret values.
- Do not change runtime env var names.
- Do not add deploy automation beyond documenting the existing flow.

## Git workflow

- Branch: `codex/007-document-setup-env`
- Commit style: conventional commits, for example
  `docs: document setup and environment`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Create `.env.example`

Create `.env.example` with placeholder values only:

```dotenv
BOT_TOKEN=
TG_CHANNEL_ID=
TG_OWNER_ID=
DB_HOST=
DB_NAME=
DB_USER=
DB_PASSWORD=
WHOIS_SERVER=
WHOIS_PROXY_URL=
WHOIS_PROXY_PORT=
```

Add comments only where they clarify optional values. Do not include production
values.

**Verify**: `rg -n 'BOT_TOKEN|TG_OWNER_ID|DB_HOST|WHOIS_PROXY_PORT' .env.example`
shows all required and optional names.

### Step 2: Create `README.md`

Create a concise README with:

- What the bot does.
- Requirements: Node 22 from `.nvmrc`, MongoDB, Telegram bot token.
- Setup:
  `cp .env.example .env`, fill values, `npm ci`.
- Local commands:
  `npm run dev`, `npm run test:run`, `npm run lint`, `npm run build`.
- Deploy note matching `AGENTS.md`: server deploy stays simple
  `git pull` -> `npm ci` -> PM2; build runs via `postinstall`.
- PM2 note: after PM2 config changes, run `npm run pm2:recreate`.
- Dependency warning: keep `whois` exactly `2.14.2`.

**Verify**: `rg -n 'postinstall|pm2:recreate|whois.*2\\.14\\.2|npm run test:run' README.md`
shows those operational notes.

### Step 3: Run docs-safe verification

**Verify**:
- `npm run lint` -> exit 0.
- `npm run build` -> exit 0.

If dependencies are not installed, run `npm ci` first.

## Test plan

No new tests are required for docs-only changes. The build and lint commands
ensure no accidental source edits broke the repo.

## Done criteria

- [ ] `.env.example` exists and contains every env var used by `src/env.ts`.
- [ ] `README.md` documents setup, commands, deploy flow, PM2 recreate, and
      `whois@2.14.2` pin.
- [ ] No secret values are present.
- [ ] `npm run lint` and `npm run build` exit 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report if:

- You discover a real secret in existing files. Do not copy it; report file and
  line only.
- README content would contradict `AGENTS.md`.
- The operator wants deployment commands changed rather than documented.

## Maintenance notes

Keep README operational and short. If env vars are added later, update
`.env.example`, `README.md`, and `src/env.ts` together in the same PR.
