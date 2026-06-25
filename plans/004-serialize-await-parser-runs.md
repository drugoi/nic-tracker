# Plan 004: Serialize and await NIC parser runs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c027afb..HEAD -- src/index.ts src/parse.ts src/parse.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-add-critical-characterization-tests.md`
- **Category**: bug
- **Planned at**: commit `c027afb`, 2026-06-24

## Why this matters

`parseNic()` is declared async but internally starts a promise chain and returns
before fetch, database writes, WHOIS calls, and Telegram sends finish. Startup
and cron both call it with `void`, so slow runs can overlap and failures from
unawaited Telegram sends can escape the local error handling. A serialized,
awaitable parser makes production behavior easier to reason about and gives
future `/status` reporting a reliable lifecycle.

## Current state

Relevant files:

- `src/index.ts` schedules parser runs.
- `src/parse.ts` performs the parser workflow.
- `src/parse.test.ts` should exist after plan 001.

Current excerpts:

```ts
// src/index.ts:17-26
void parseNic();
...
cron.schedule('*/5 * * * *', () => {
  void parseNic();
}).start();
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
// src/parse.ts:119-121
bot.telegram.sendMessage(env.tgChannelId, message, {
  parse_mode: 'MarkdownV2',
});
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Focused tests | `npm run test:run -- src/parse.test.ts` | exit 0 |
| Full tests | `npm run test:run` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:
- `src/parse.ts`
- `src/index.ts`
- `src/parse.test.ts`

**Out of scope**:
- Do not change domain parsing semantics.
- Do not change Telegram message text or Markdown formatting.
- Do not introduce a job queue or external scheduler.
- Do not change cron cadence unless tests prove the current cadence is wrong.

## Git workflow

- Branch: `codex/004-serialize-parser-runs`
- Commit style: conventional commits, for example
  `fix(parser): serialize scheduled nic parsing`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add failing lifecycle tests

Extend `src/parse.test.ts` with tests that prove the desired behavior:

- `await parseNic(fakeAxios)` does not resolve until `fakeAxios.get`, Mongo
  insert/update, WHOIS parsing, and Telegram sends complete.
- A Telegram send rejection is caught and logged by the parser error handling
  path instead of becoming an unhandled promise.
- Two concurrent parser calls do not execute the core workflow at the same
  time. The second call should either no-op with a clear log or await the
  active run; choose one behavior and document it in the test name.

**Verify**: `npm run test:run -- src/parse.test.ts` -> fails before the fix.

### Step 2: Rewrite `parseNic()` to use `await`

In `src/parse.ts`, replace the `requestInstance.get('').then(...).catch(...)`
chain with structured `try`/`catch` and `await`.

Keep the existing logic order:

1. Resolve request and DB instances.
2. Fetch NIC HTML.
3. Parse rows into `newDomains`.
4. Insert/update domains and archive old versions.
5. Send Telegram messages.
6. Notify owner on fetch/runtime errors.

Await every `bot.telegram.sendMessage(...)` call.

**Verify**: `npm run test:run -- src/parse.test.ts` -> lifecycle tests should
now pass except the serialization case if not implemented yet.

### Step 3: Add a module-level run guard

Add a small module-level guard in `src/parse.ts`, for example:

```ts
let activeParse: Promise<void> | undefined;

export async function parseNic(...): Promise<void> {
  if (activeParse) {
    return activeParse;
  }
  activeParse = runParseNic(...);
  try {
    await activeParse;
  } finally {
    activeParse = undefined;
  }
}
```

Use a private `runParseNic` function for the existing workflow. This keeps the
public API the same while preventing overlapping runs. If the second call
should no-op instead of joining the active run, encode that explicitly and test
it.

**Verify**: `npm run test:run -- src/parse.test.ts` -> exit 0.

### Step 4: Await parser runs in the scheduler

In `src/index.ts`, replace bare `void parseNic()` calls with a small helper
that awaits and logs errors:

```ts
async function runParser(): Promise<void> {
  try {
    await parseNic();
  } catch (error) {
    console.error('[PARSER] run error', error);
  }
}
```

Call `void runParser()` from startup and cron. The `void` remains only at the
top-level fire-and-forget boundary; inside the helper, the parser is awaited.

**Verify**: `npm run build` -> exit 0.

### Step 5: Run the full gate

**Verify**:
- `npm run test:run` -> exit 0.
- `npm run lint` -> exit 0.
- `npm run build` -> exit 0.

## Optional real validation

After deployment, use `ssh root@drugoi.xyz` only for read-only checks unless
the operator approves writes. Confirm PM2 logs show one parser run at a time
during a cron tick and a manual proxy-triggered parse. Do not print `.env` or
Mongo credentials.

## Test plan

- `src/parse.test.ts`: await lifecycle, no unhandled send failures, no overlap.
- Existing parser insertion/skipping tests from plan 001 continue to pass.
- Full suite remains green.

## Done criteria

- [ ] `parseNic()` resolves only after its workflow finishes.
- [ ] Telegram sends in parser are awaited.
- [ ] Concurrent runs are serialized or joined with tested behavior.
- [ ] `src/index.ts` awaits parser work inside a helper.
- [ ] `npm run test:run`, `npm run lint`, and `npm run build` exit 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report if:

- The desired overlap behavior cannot be decided from current product needs.
- Avoiding overlap requires a database lock or distributed scheduler.
- Tests require real NIC, Telegram, or MongoDB access.

## Maintenance notes

If this bot is ever run with multiple PM2 instances, the in-process guard will
not prevent cross-process overlap. That is explicitly out of scope here and
should be handled with a Mongo-backed lock only if multiple instances become a
real deployment target.
