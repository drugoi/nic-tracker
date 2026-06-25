# Plan 009: Spike owner-only operational status command

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c027afb..HEAD -- src/bot.ts src/parse.ts src/db.ts src/types.ts src/*.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/002-restrict-admin-bot-commands.md`, `plans/004-serialize-await-parser-runs.md`
- **Category**: direction
- **Planned at**: commit `c027afb`, 2026-06-24

## Why this matters

Operational visibility is mostly console logs and owner messages on fetch
errors. An owner-only `/status` command can answer basic production questions:
whether the bot has parsed recently, whether the last run failed, how many
domains were found, and what proxy state is configured. This is especially
useful because production DB validation is available over SSH but should not be
needed for routine checks.

## Current state

Relevant files:

- `src/bot.ts` owns commands.
- `src/parse.ts` knows parser run results but does not persist status.
- `src/db.ts` owns Mongo access and settings.

Current excerpts:

```ts
// src/parse.ts:123-134
} catch (error) {
  console.error('[PARSER] insert error', error);
}
})
.catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[PARSER] fetch error', message);

  bot.telegram.sendMessage(env.tgOwnerId, message, {
```

```ts
// src/bot.ts:40-44
bot.command('getproxy', async (ctx) => {
  const database = await getDb();
  const doc = await database.collection('settings').findOne({});
  const proxyUrl = doc && typeof doc.proxy === 'string' ? doc.proxy : undefined;
  await ctx.reply(proxyUrl || 'Прокси не установлена');
});
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Focused tests | `npm run test:run -- src/bot.test.ts src/parse.test.ts src/db.test.ts` | exit 0 |
| Full tests | `npm run test:run` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:
- `src/types.ts`
- `src/db.ts`
- `src/parse.ts`
- `src/bot.ts`
- Relevant tests
- Optional README update if plan 007 has landed

**Out of scope**:
- Do not add a web dashboard.
- Do not expose status to non-owners.
- Do not include secrets or full proxy URLs in status by default; show
  "enabled" or a redacted host unless the operator asks otherwise.

## Git workflow

- Branch: `codex/009-owner-status-command`
- Commit style: conventional commits, for example
  `feat(bot): add owner status command`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Define minimal status data

Use a small `status` or `parserStatus` field in the settings document, or a
separate singleton collection if that is cleaner. Suggested shape:

```ts
interface ParserStatus {
  lastStartedAt?: number;
  lastFinishedAt?: number;
  lastSuccessAt?: number;
  lastError?: string;
  lastDomainCount?: number;
}
```

Store timestamps as `Date.now()` numbers to match existing `DomainDoc.date`.

**Verify**: update `src/types.ts` and `npm run build` exits 0.

### Step 2: Add DB helpers and tests

In `src/db.ts`, add helpers such as `getStatus()` and `updateParserStatus()`.
Ensure updating status does not overwrite `proxy` or future `watchTerms`.

Tests should cover:

- Updating status preserves existing settings fields.
- Missing settings document is created with status and default proxy.
- Reading status returns a stable empty object when absent.

**Verify**: `npm run test:run -- src/db.test.ts` -> exit 0.

### Step 3: Record parser status

In `src/parse.ts`, update status:

- At run start: `lastStartedAt`.
- On successful completion: `lastFinishedAt`, `lastSuccessAt`, clear
  `lastError`, and set `lastDomainCount`.
- On caught failure: `lastFinishedAt` and `lastError` as a short message.

Do not store stack traces or large raw error objects.

**Verify**: `npm run test:run -- src/parse.test.ts` -> exit 0.

### Step 4: Add owner-only `/status`

In `src/bot.ts`, add `/status` behind the owner guard from plan 002. The
message should include:

- Last start and finish time if available.
- Last success time if available.
- Last error, if any, shortened to a safe length.
- Proxy state: enabled/disabled, not raw credentials.
- Last domain count.

Use plain text or Markdown that is already safely escaped. Do not introduce a
new Markdown escaping surface unless needed.

**Verify**: `npm run test:run -- src/bot.test.ts` -> exit 0.

### Step 5: Run the full gate

**Verify**:
- `npm run test:run` -> exit 0.
- `npm run lint` -> exit 0.
- `npm run build` -> exit 0.

## Optional real validation

After deployment, run `/status` as the owner and confirm it does not expose
secrets. If DB inspection is needed, use `ssh root@drugoi.xyz` for read-only
inspection of only the status fields. Do not print `.env` or connection
strings.

## Test plan

- DB helper tests for preserving settings fields.
- Parser tests for status updates on success and failure.
- Bot tests for owner-only `/status` and non-owner denial.

## Done criteria

- [ ] Parser records last run status without stack traces or secrets.
- [ ] Owner-only `/status` reports useful operational state.
- [ ] Non-owner `/status` is denied.
- [ ] Proxy status is redacted.
- [ ] `npm run test:run`, `npm run lint`, and `npm run build` exit 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report if:

- Plan 004 has not landed and parser lifecycle is still not awaitable.
- The operator wants multi-process status aggregation.
- Status storage would require a migration of existing documents with unknown
  shape.

## Maintenance notes

Keep status bounded. Do not append historical run logs to the settings
document; if history becomes valuable, create a capped collection in a separate
plan.
