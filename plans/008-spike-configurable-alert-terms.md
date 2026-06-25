# Plan 008: Spike configurable watched alert terms

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c027afb..HEAD -- src/parse.ts src/bot.ts src/db.ts src/types.ts src/*.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/002-restrict-admin-bot-commands.md`, `plans/006-preserve-proxy-on-settings-create.md`
- **Category**: direction
- **Planned at**: commit `c027afb`, 2026-06-24

## Why this matters

The parser has a hardcoded alert for domains containing `bereke`. Making alert
terms configurable would let the owner track new brands or keywords without a
code deploy. This is a direction/spike plan: design the smallest durable shape,
implement only if the scope stays simple, and stop if it needs a larger product
decision.

## Current state

Relevant files:

- `src/parse.ts` contains the hardcoded alert term.
- `src/db.ts` stores a singleton settings document with `proxy`.
- `src/bot.ts` already has admin command patterns for settings.
- `src/types.ts` defines `SettingsDoc`.

Current excerpts:

```ts
// src/parse.ts:87-94
if (domain.domain.includes('bereke')) {
  bot.telegram.sendMessage(
    env.tgOwnerId,
    `Новый домен: ${domain.domain}`,
    {
      parse_mode: 'Markdown',
    },
  );
}
```

```ts
// src/types.ts:4-6
export interface SettingsDoc {
  proxy?: string;
}
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
- `src/bot.ts`
- `src/parse.ts`
- Relevant tests in `src/*.test.ts`
- Optional README update if plan 007 has landed

**Out of scope**:
- Do not build a full rules engine.
- Do not add regex support in the first implementation.
- Do not add public non-owner controls.
- Do not change channel notification format except the owner alert trigger.

## Git workflow

- Branch: `codex/008-configurable-alert-terms`
- Commit style: conventional commits, for example
  `feat(bot): configure watched alert terms`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Decide the minimal schema

Use the existing settings document and add:

```ts
watchTerms?: string[];
```

Default should preserve current behavior: if no `watchTerms` exists, use
`['bereke']`. Matching should be case-insensitive substring matching on the
domain.

**Verify**: write this decision in the PR notes or README if docs exist.

### Step 2: Add tests for parser alert terms

Extend `src/parse.test.ts` so parser alert behavior is driven by settings:

- Missing `watchTerms` still alerts on `bereke`.
- `watchTerms: ['acme']` alerts on `new-acme.kz`.
- `watchTerms: ['acme']` does not alert on unrelated domains.
- Matching is case-insensitive.

**Verify**: `npm run test:run -- src/parse.test.ts` -> fails before the
implementation.

### Step 3: Add owner-only bot commands for terms

Add owner-only commands in `src/bot.ts`, keeping names simple:

- `/watchterms` replies with the current terms.
- `/addwatchterm term` adds one normalized term.
- `/removewatchterm term` removes one term.

Reuse the owner guard from plan 002. Store terms through `src/db.ts` helpers;
do not let `src/bot.ts` manipulate raw Mongo update shapes in many places.

**Verify**: `npm run test:run -- src/bot.test.ts` -> exit 0.

### Step 4: Update settings helpers and parser

In `src/db.ts`, add small helpers to read and update `watchTerms`. Preserve
existing `proxy` behavior. In `src/parse.ts`, replace the hardcoded `bereke`
check with a helper that reads settings once per parse run and checks terms.

Await the owner alert send if plan 004 has landed.

**Verify**: `npm run test:run -- src/parse.test.ts src/db.test.ts` -> exit 0.

### Step 5: Run the full gate

**Verify**:
- `npm run test:run` -> exit 0.
- `npm run lint` -> exit 0.
- `npm run build` -> exit 0.

## Optional real validation

After deployment, the operator can use `ssh root@drugoi.xyz` for read-only DB
inspection of the `settings.watchTerms` field. Prefer validating through bot
commands first. Do not print credentials or unrelated settings values.

## Test plan

- Parser tests for default and configured term matching.
- Bot command tests for owner-only list/add/remove.
- DB helper tests for preserving proxy while updating terms.

## Done criteria

- [ ] Default alert behavior for `bereke` is preserved.
- [ ] Owner can list, add, and remove watch terms.
- [ ] Non-owner cannot change watch terms.
- [ ] Parser reads configured terms and matches case-insensitively.
- [ ] `npm run test:run`, `npm run lint`, and `npm run build` exit 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report if:

- The operator wants regexes, per-term channels, or multi-owner permissions.
- Settings schema has changed away from a singleton document.
- Plan 002 owner guard is not available.

## Maintenance notes

If watch terms become more complex, move from string arrays to explicit rule
objects in a separate migration. Keep this first version intentionally small.
