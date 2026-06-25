# Plan 001: Add critical bot/parser/request characterization tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c027afb..HEAD -- src/bot.ts src/parse.ts src/request.ts src/db.ts src/helpers.test.ts src/whois.test.ts vitest.config.ts package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `c027afb`, 2026-06-24

## Why this matters

The highest-risk runtime surfaces have no direct tests: Telegram command
authorization, Mongo settings writes, Axios proxy refresh, and NIC parser
scheduling. Plans 002, 003, 004, and 006 change those surfaces. This plan adds
small characterization tests first so later executors can change behavior
without guessing whether they broke the bot.

## Current state

- `src/helpers.test.ts` and `src/whois.test.ts` are the only tests.
- `src/bot.ts` registers commands at module import time and currently has no
  tests.
- `src/parse.ts` mixes fetch, HTML parsing, Mongo writes, WHOIS, and Telegram
  sends in one promise chain and currently has no tests.
- `src/request.ts` builds an Axios client from the Mongo settings document and
  currently has no tests.

Current excerpts:

```ts
// src/bot.ts:17-27
bot.command('proxy', async (ctx) => {
  const { message } = ctx;
  if (!message || !('text' in message)) {
    return;
  }
  if (message.entities?.some((entity) => entity.type === 'url')) {
    const proxyUrl = message.text.replace('/proxy ', '');
    await updateSettings(proxyUrl);
    await ctx.reply('URL прокси успешно изменён');
    const instance = await getInstance();
    parseNic(instance);
```

```ts
// src/parse.ts:38-44
export async function parseNic(axiosInstance?: AxiosInstance): Promise<void> {
  const requestInstance = axiosInstance ?? (await request.getInstance());
  const dbInstance = await db.getDb();

  requestInstance
    .get('')
    .then(async (res) => {
```

```ts
// src/request.ts:8-16
export async function initAxios(): Promise<AxiosInstance> {
  const dbInstance = await db.getDb();
  const doc = await dbInstance.collection('settings').findOne({});
  const proxyDbUrl = doc && typeof doc.proxy === 'string' ? doc.proxy : undefined;

  const httpsAgent = () => {
    if (proxyDbUrl) {
```

Test conventions to match:

```ts
// src/whois.test.ts:1-16
import whois from 'whois';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
...
vi.mock('whois', () => ({
  default: {
    lookup: vi.fn(),
  },
}));
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0; `postinstall` also runs `npm run build` |
| Tests | `npm run test:run` | exit 0; all Vitest tests pass |
| Lint | `npm run lint` | exit 0; no ESLint errors |
| Build | `npm run build` | exit 0; TypeScript emits `dist/` |

## Scope

**In scope**:
- `src/bot.test.ts` (create)
- `src/parse.test.ts` (create)
- `src/request.test.ts` (create)
- `src/db.test.ts` (create only if needed by plan 006 coverage)
- Minimal testability-only exports or helpers in `src/bot.ts`, `src/parse.ts`,
  `src/request.ts`, or `src/db.ts` if tests cannot otherwise observe behavior.

**Out of scope**:
- Do not implement the fixes from plans 002, 003, 004, or 006 here.
- Do not change production behavior except for harmless testability seams.
- Do not touch deploy scripts, `package-lock.json`, or `whois` versioning.

## Git workflow

- Branch: `codex/001-characterization-tests`
- Commit style: conventional commits, for example
  `test: add bot command characterization coverage`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Install and run the existing baseline

Run `npm ci` first. This repo intentionally compiles during `postinstall`; do
not remove that behavior.

**Verify**: `npm run test:run` -> exit 0 with the existing helper and WHOIS
tests passing.

### Step 2: Add bot command characterization tests

Create `src/bot.test.ts`. Mock:

- `./bot-setup.js` with a fake `bot.command`, `bot.catch`, and `bot.launch`.
- `./db.js` with spies for `updateSettings` and `getDb`.
- `./request.js` with a spy for `getInstance`.
- `./parse.js` with a spy for `parseNic`.
- `./whois.js` with a spy for `whoisAndParse`.

Import `src/bot.ts` after mocks are registered so command handlers are
captured. Cover current behavior, not future behavior:

- `/proxy http://proxy.example:8080` calls `updateSettings` with that string,
  replies success, calls `getInstance`, and invokes `parseNic`.
- `/disableproxy` calls `updateSettings('')`, replies success, calls
  `getInstance`, and invokes `parseNic`.
- `/getproxy` reads the settings collection and replies with the proxy string.
- `/whois example.kz` calls `whoisAndParse('example.kz', true)` and replies
  with the returned string.

**Verify**: `npm run test:run -- src/bot.test.ts` -> exit 0 with the new tests
passing.

### Step 3: Add request proxy characterization tests

Create `src/request.test.ts`. Mock `./db.js` so `getDb()` returns a fake
settings collection. Mock `tunnel.httpsOverHttp` so the test can see which
proxy host and port were requested.

Cover current behavior:

- No settings proxy returns an Axios instance whose defaults have
  `proxy: false`.
- A settings proxy like `http://proxy.example:3128` builds a tunnel agent with
  host `proxy.example` and port `3128`.
- After `initAxios()` has read one proxy, changing the mocked DB value does not
  affect the same existing client until the code is explicitly reinitialized.
  This test documents the bug that plan 003 will change.

If the third case cannot be tested without exposing a reset helper, add a
test-only reset exported from `src/request.ts` with a clear name such as
`resetAxiosForTest` and keep it small.

**Verify**: `npm run test:run -- src/request.test.ts` -> exit 0.

### Step 4: Add parser lifecycle characterization tests

Create `src/parse.test.ts`. Mock:

- `./request.js` for `getInstance`.
- `./db.js` for `getDb`.
- `./bot-setup.js` for `bot.telegram.sendMessage`.
- `./whois.js` for `whoisAndParse`.

Use a small NIC-like HTML fixture inline or in a test helper:

```html
<table id="last-ten-table"><tbody><tr></tr><tr><td><table><tbody>
<tr><td>2026-06-24</td><td><a>example.kz</a></td></tr>
</tbody></table></td></tr></tbody></table>
```

Cover:

- A previously unseen domain is inserted into `domains` and queued for a
  Telegram send.
- An existing domain younger than 10 days is skipped.
- A fetch rejection notifies `TG_OWNER_ID`.

If current `parseNic()` returning before work finishes makes these tests
awkward, use `await new Promise(setImmediate)` in the test to document the
current behavior. Do not fix the lifecycle in this plan.

**Verify**: `npm run test:run -- src/parse.test.ts` -> exit 0.

### Step 5: Run the full local gate

Run all project verification commands.

**Verify**:
- `npm run test:run` -> exit 0.
- `npm run lint` -> exit 0.
- `npm run build` -> exit 0.

## Test plan

This plan is itself a test plan. New tests should follow the Vitest mocking
style in `src/whois.test.ts`. Prefer small fake objects over real network,
Telegram, or MongoDB calls.

## Done criteria

- [ ] `src/bot.test.ts`, `src/request.test.ts`, and `src/parse.test.ts` exist.
- [ ] The tests cover current behavior for bot commands, request proxy setup,
      and parser fetch/insert/send flows.
- [ ] `npm run test:run` exits 0.
- [ ] `npm run lint` exits 0.
- [ ] `npm run build` exits 0.
- [ ] No files outside the in-scope list are modified, except generated ignored
      files from `npm ci`/build.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report if:

- The live code no longer matches the excerpts above.
- Tests require real Telegram, real `nic.kz`, or real MongoDB access.
- You need to implement authorization, proxy refresh, or parser serialization
  to make this plan pass.
- `npm ci` fails because `whois@2.14.2` cannot be installed.

## Maintenance notes

These tests are meant to protect upcoming behavior changes. Reviewers should
scrutinize any broad production refactor introduced only for testability; this
repo is small, and test seams should remain small.
