# Plan 010: Add fixture-based NIC parser regression tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c027afb..HEAD -- src/parse.ts src/parse.test.ts src/fixtures`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/001-add-critical-characterization-tests.md`, `plans/004-serialize-await-parser-runs.md`
- **Category**: tests
- **Planned at**: commit `c027afb`, 2026-06-24

## Why this matters

The parser depends on a specific `nic.kz` table shape. If the markup changes,
the bot can silently stop detecting domains. A saved fixture and parser tests
make that dependency visible and give maintainers a cheap regression signal
before deploy.

## Current state

Relevant files:

- `src/parse.ts` contains the DOM selector and row extraction.
- `src/parse.test.ts` should exist after plan 001.
- `src/fixtures/` does not currently exist.

Current excerpt:

```ts
// src/parse.ts:45-63
const $ = cheerio.load(res.data as string);
const domainsTable = $(
  '#last-ten-table > tbody > tr:nth-child(2) > td > table > tbody',
);
...
const link = $('a', domain).first();
if (link.length > 0) {
  const newDomain: Pick<DomainDoc, 'domain' | 'nicDate' | 'date'> = {
    domain: link.text(),
    nicDate: row.find('td:first-child').text(),
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
- `src/parse.test.ts`
- `src/fixtures/nic-last-ten.html` (create)

**Out of scope**:
- Do not fetch live `nic.kz` during automated tests.
- Do not change domain notification behavior.
- Do not add browser/e2e tests.

## Git workflow

- Branch: `codex/010-nic-html-fixture-tests`
- Commit style: conventional commits, for example
  `test(parser): add nic html fixture coverage`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Extract pure HTML row parsing if needed

If `src/parse.test.ts` already covers fixture HTML through `parseNic()`, keep
that. Otherwise, extract a small pure helper from `parseNic()` such as:

```ts
function parseNicDomains(html: string): Pick<DomainDoc, 'domain' | 'nicDate' | 'date'>[]
```

For deterministic tests, allow the helper to accept a `now` value or set `date`
outside the pure HTML parser. Keep the helper local unless tests need it
exported.

**Verify**: `npm run build` -> exit 0.

### Step 2: Add a committed fixture

Create `src/fixtures/nic-last-ten.html` with a minimal but realistic copy of
the table shape the selector expects:

- Element id `last-ten-table`.
- Second row containing the nested table.
- At least two domain rows.
- One non-domain row or empty cell to prove it is ignored.

Do not include scraped personal data or production secrets.

**Verify**: `rg -n 'last-ten-table|\\.kz' src/fixtures/nic-last-ten.html`
shows the fixture contains the expected selector and sample domains.

### Step 3: Add fixture tests

Extend `src/parse.test.ts` to load the fixture and assert:

- The parser extracts expected domain names.
- The parser extracts the first cell as `nicDate`.
- Non-domain rows are ignored.
- An empty/missing table yields no domains and does not throw.

Use `node:fs/promises` and `new URL('./fixtures/nic-last-ten.html', import.meta.url)`
if loading from disk.

**Verify**: `npm run test:run -- src/parse.test.ts` -> exit 0.

### Step 4: Run the full gate

**Verify**:
- `npm run test:run` -> exit 0.
- `npm run lint` -> exit 0.
- `npm run build` -> exit 0.

## Optional real validation

If the operator wants to refresh the fixture from production, do it manually
outside automated tests and review the HTML before committing. The server can
be reached with `ssh root@drugoi.xyz`, but do not commit raw pages containing
personal data or secrets.

## Test plan

This plan adds parser fixture tests. Existing parser tests from plans 001 and
004 should remain green.

## Done criteria

- [ ] A NIC HTML fixture exists under `src/fixtures/`.
- [ ] Parser tests cover expected extraction and missing-table behavior.
- [ ] Automated tests do not perform live network fetches.
- [ ] `npm run test:run`, `npm run lint`, and `npm run build` exit 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report if:

- A realistic fixture would contain personal data that cannot be safely
  redacted.
- Extracting a pure parser helper requires a broad rewrite of `parseNic()`.
- Plan 004 has not landed and the parser lifecycle makes reliable tests
  impractical.

## Maintenance notes

When `nic.kz` markup changes, update the fixture and parser together. Keep the
fixture small enough that diffs remain reviewable.
