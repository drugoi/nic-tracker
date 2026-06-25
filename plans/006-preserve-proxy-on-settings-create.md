# Plan 006: Preserve requested proxy when creating missing settings

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c027afb..HEAD -- src/db.ts src/db.test.ts src/bot.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/001-add-critical-characterization-tests.md`
- **Category**: bug
- **Planned at**: commit `c027afb`, 2026-06-24

## Why this matters

If the single settings document is missing, `updateSettings(proxyUrl)` creates
`{ proxy: '' }` and drops the proxy value the caller asked to save. The bot can
reply success while the setting remains disabled. This is an edge case, but the
fix is small and protects recovery from accidental settings deletion.

## Current state

Relevant files:

- `src/db.ts` owns settings initialization and updates.
- `src/db.test.ts` may be created by plan 001 or this plan.

Current excerpt:

```ts
// src/db.ts:20-38
export async function updateSettings(proxyUrl?: string): Promise<void> {
  if (!db) {
    return;
  }
  try {
    const settings = await db.collection('settings').findOne({});

    if (!settings) {
      console.log('[SETTINGS] creating default document');
      await db.collection('settings').insertOne({
        proxy: '',
      });
      console.log('[SETTINGS] created');
    } else if (typeof proxyUrl === 'string') {
      console.log('[SETTINGS] updating proxy');
      await db.collection('settings').updateOne(
        {},
        { $set: { proxy: proxyUrl } },
      );
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Focused tests | `npm run test:run -- src/db.test.ts` | exit 0 |
| Full tests | `npm run test:run` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:
- `src/db.ts`
- `src/db.test.ts`

**Out of scope**:
- Do not change collection names.
- Do not add multiple settings documents.
- Do not alter Mongo connection string construction.

## Git workflow

- Branch: `codex/006-preserve-proxy-on-settings-create`
- Commit style: conventional commits, for example
  `fix(db): preserve proxy when creating settings`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add failing tests for missing settings

Create or extend `src/db.test.ts`. Mock Mongo collection behavior enough to
test `updateSettings()`:

- When `findOne({})` returns `null` and `updateSettings('http://p:8080')` is
  called, `insertOne` should receive `{ proxy: 'http://p:8080' }`.
- When `findOne({})` returns `null` and `updateSettings()` is called with no
  argument, `insertOne` should receive `{ proxy: '' }`.
- When settings exists and `updateSettings('')` is called, `updateOne` should
  set `{ proxy: '' }`.

If current module-level `db` makes this hard, add a small test-only setter or
extract pure settings write logic. Keep the public behavior unchanged.

**Verify**: `npm run test:run -- src/db.test.ts` -> fails before the fix.

### Step 2: Preserve the provided proxy during insert

In `src/db.ts`, change the insert path to:

```ts
await db.collection('settings').insertOne({
  proxy: typeof proxyUrl === 'string' ? proxyUrl : '',
});
```

Keep the existing update path for existing documents.

**Verify**: `npm run test:run -- src/db.test.ts` -> exit 0.

### Step 3: Run the full gate

**Verify**:
- `npm run test:run` -> exit 0.
- `npm run lint` -> exit 0.
- `npm run build` -> exit 0.

## Optional real validation

Only with operator approval, use `ssh root@drugoi.xyz` for a controlled
database validation. Prefer a read-only check that the settings document exists.
Do not delete or mutate production settings unless the operator explicitly asks
for that validation. Do not print credentials.

## Test plan

- `src/db.test.ts`: missing settings with proxy, missing settings without
  proxy, existing settings update.
- Full suite remains green.

## Done criteria

- [ ] Missing settings insert preserves a string `proxyUrl`.
- [ ] Missing settings insert still defaults to empty proxy when no value is
      provided.
- [ ] Existing settings update behavior remains unchanged.
- [ ] `npm run test:run`, `npm run lint`, and `npm run build` exit 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report if:

- Testing requires connecting to a real MongoDB instance.
- The code has already been refactored so `updateSettings` no longer owns
  settings creation.
- Fixing this requires a schema migration.

## Maintenance notes

The settings collection currently assumes one document selected by `{}`. If
future settings grow, introduce a stable `_id` or key before adding more
settings, so updates do not depend on arbitrary first-document behavior.
