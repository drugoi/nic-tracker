# Plan 003: Make proxy changes affect the live Axios client

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c027afb..HEAD -- src/request.ts src/bot.ts src/request.test.ts src/bot.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/001-add-critical-characterization-tests.md`
- **Category**: bug
- **Planned at**: commit `c027afb`, 2026-06-24

## Why this matters

The bot tells the owner that `/proxy` and `/disableproxy` succeeded, but the
already-created Axios instance keeps using the proxy value captured during
`initAxios()`. That makes the command misleading and can leave production
scraping stuck on the wrong network path until process restart. The fix should
be narrow: after settings change, rebuild or refresh the Axios client in one
well-named place.

## Current state

Relevant files:

- `src/request.ts` owns the singleton Axios instance.
- `src/bot.ts` calls `updateSettings`, then `getInstance`, then `parseNic`.
- `src/request.test.ts` should exist after plan 001.

Current excerpts:

```ts
// src/request.ts:8-16
export async function initAxios(): Promise<AxiosInstance> {
  const dbInstance = await db.getDb();
  const doc = await dbInstance.collection('settings').findOne({});
  const proxyDbUrl = doc && typeof doc.proxy === 'string' ? doc.proxy : undefined;

  const httpsAgent = () => {
    if (proxyDbUrl) {
      const proxyUrl = new URL(proxyDbUrl);
```

```ts
// src/request.ts:34-38
instance.interceptors.request.use(
  (config) => {
    const next = { ...config };
    next.httpsAgent = httpsAgent();
    return next;
```

```ts
// src/bot.ts:24-27
await updateSettings(proxyUrl);
await ctx.reply('URL прокси успешно изменён');
const instance = await getInstance();
parseNic(instance);
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Focused tests | `npm run test:run -- src/request.test.ts src/bot.test.ts` | exit 0 |
| Full tests | `npm run test:run` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:
- `src/request.ts`
- `src/bot.ts`
- `src/request.test.ts`
- `src/bot.test.ts`

**Out of scope**:
- Do not change proxy storage schema.
- Do not add a new deploy step; deploy stays `git pull` -> `npm ci` -> PM2,
  with build from `postinstall`.
- Do not change WHOIS SOCKS proxy env handling in `src/whois.ts`.

## Git workflow

- Branch: `codex/003-refresh-live-axios-proxy`
- Commit style: conventional commits, for example
  `fix(request): refresh axios proxy after settings changes`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Change the characterization test expectation

Update `src/request.test.ts` so the bug case now expects a refreshed client to
read the new DB proxy. The exact API is up to the implementation, but the test
should prove:

- Initial settings proxy is used.
- After settings changes and the refresh function is called, the next request
  uses the new proxy or no proxy.

**Verify**: `npm run test:run -- src/request.test.ts` -> fails before the fix.

### Step 2: Add an explicit refresh API in `src/request.ts`

Add a function such as:

```ts
export async function refreshAxios(): Promise<AxiosInstance> {
  instance = undefined;
  return initAxios();
}
```

If duplicate interceptors become a risk, prefer replacing the singleton by
calling `axios.create(...)` again rather than mutating defaults on the old
instance. Keep `getInstance()` behavior unchanged for callers that just need an
existing client.

**Verify**: `npm run test:run -- src/request.test.ts` -> exit 0.

### Step 3: Use the refresh API after proxy-setting commands

In `src/bot.ts`, after successful `updateSettings(...)`, call the new refresh
function instead of `getInstance()`. Pass the refreshed instance to `parseNic`.
Do this for both `/proxy` and `/disableproxy`.

Update `src/bot.test.ts` to assert that the refresh function is called and its
returned instance is passed to `parseNic`.

**Verify**: `npm run test:run -- src/bot.test.ts src/request.test.ts` -> exit 0.

### Step 4: Run the full gate

**Verify**:
- `npm run test:run` -> exit 0.
- `npm run lint` -> exit 0.
- `npm run build` -> exit 0.

## Optional real validation

After deployment, the operator can validate on the server with
`ssh root@drugoi.xyz` and the bot UI:

1. Set a known working proxy with `/proxy ...`.
2. Observe that the next immediate parse uses the new route.
3. Run `/disableproxy` and observe direct fetch behavior resumes.

Do not print proxy secrets or database credentials. If DB inspection is needed,
use a read-only Mongo shell query for the `settings` document only.

## Test plan

- `src/request.test.ts`: refreshed client uses changed proxy settings.
- `src/bot.test.ts`: `/proxy` and `/disableproxy` call refresh, not plain
  `getInstance`.
- Existing helper and WHOIS tests remain unchanged.

## Done criteria

- [ ] A public request refresh function exists and is used by proxy commands.
- [ ] Existing `getInstance()` behavior remains compatible.
- [ ] Proxy refresh tests fail before and pass after the fix.
- [ ] `npm run test:run`, `npm run lint`, and `npm run build` exit 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report if:

- The implementation requires changing Mongo settings schema.
- Axios/tunnel behavior cannot be tested without real network calls.
- Fixing this reveals invalid proxy URL handling that needs a broader validation
  design. Report that separately instead of expanding scope.

## Maintenance notes

Future settings that affect HTTP behavior should use the same refresh path.
Reviewers should check that old Axios instances are not retained accidentally
by long-lived parser calls.
