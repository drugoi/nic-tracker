# Plan 005: Update vulnerable dependencies without breaking runtime constraints

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c027afb..HEAD -- package.json package-lock.json AGENTS.md src/whois.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `c027afb`, 2026-06-24

## Why this matters

`npm audit --audit-level=high` reports high and critical vulnerabilities in
the current dependency graph, including production-path `axios` and dev/test
`vitest`. The repo has a known runtime constraint: `whois` must remain pinned
exactly to `2.14.2`. The goal is to reduce the audit surface with normal
dependency updates while preserving the TypeScript build and deployment model.

## Current state

Relevant files:

- `package.json` contains runtime and dev dependencies.
- `package-lock.json` locks resolved versions.
- `AGENTS.md` documents important runtime constraints.

Current excerpts:

```json
// package.json:25-38
"dependencies": {
  "@types/node": "^22.10.2",
  "@types/node-cron": "^3.0.11",
  "axios": "^1.7.9",
  ...
  "typescript": "^5.7.2",
  "whois": "2.14.2"
}
```

```json
// package-lock.json:1752-1760
"node_modules/axios": {
  "version": "1.14.0",
  ...
  "dependencies": {
    "follow-redirects": "^1.15.11",
    "form-data": "^4.0.5",
```

```json
// package-lock.json:5950-5958
"node_modules/vitest": {
  "version": "3.2.4",
  ...
  "dependencies": {
    "@types/chai": "^5.2.2",
    "@vitest/expect": "3.2.4",
```

```json
// package-lock.json:6087-6090
"node_modules/whois": {
  "version": "2.14.2",
```

`npm audit --audit-level=high` on 2026-06-24 reported 15 vulnerabilities.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install/update | `npm update axios vitest vite undici follow-redirects form-data` | exit 0 |
| Audit | `npm audit --audit-level=high` | exit 0, or only accepted non-production residuals documented |
| Tests | `npm run test:run` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:
- `package.json`
- `package-lock.json`
- `AGENTS.md` only if a new dependency constraint must be documented.

**Out of scope**:
- Do not change `whois` from exact `"2.14.2"`.
- Do not remove `typescript` or required `@types/*` from `dependencies`; clean
  production installs must still build during `postinstall`.
- Do not change deploy scripts or add a manual compile step.
- Do not migrate `node-cron` to v4 unless audit cannot be made acceptable
  without it; that is a breaking change.

## Git workflow

- Branch: `codex/005-update-vulnerable-dependencies`
- Commit style: conventional commits, for example
  `fix(deps): update vulnerable packages`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Establish the exact audit baseline

Run:

```bash
npm audit --audit-level=high
```

Save the package names and severity categories in your notes. Do not paste huge
audit output into code comments.

**Verify**: command exits non-zero on the current baseline and lists high or
critical advisories.

### Step 2: Update non-breaking packages first

Run:

```bash
npm update axios vitest vite undici follow-redirects form-data
```

Then inspect `package-lock.json` to confirm:

- `node_modules/whois` remains `2.14.2`.
- `package.json` still has `"whois": "2.14.2"`.
- `typescript` remains available for production `postinstall`.

**Verify**:
- `rg -n '"whois": "2.14.2"|node_modules/whois|"version": "2.14.2"' package.json package-lock.json`
  shows the exact pin remains.
- `npm run build` exits 0.

### Step 3: Run audit and decide on residuals

Run:

```bash
npm audit --audit-level=high
```

If it exits 0, proceed. If it still reports high/critical issues:

- If the remaining issue is production-path and fixable without breaking
  known constraints, update the relevant package.
- If the remaining issue requires `node-cron@4` or `whois>=2.15`, STOP and
  report the tradeoff instead of forcing a breaking migration.
- If the remaining issue is dev-only and requires a major migration, document
  it in the PR summary and leave the plan row BLOCKED only if high/critical
  remains.

**Verify**: `npm audit --audit-level=high` exits 0, or residual high/critical
findings are explicitly justified and approved by the operator.

### Step 4: Run the full project gate

**Verify**:
- `npm run test:run` -> exit 0.
- `npm run lint` -> exit 0.
- `npm run build` -> exit 0.

## Test plan

No new application tests are required unless a dependency update changes API
behavior. The regression protection is the existing Vitest suite plus build and
lint. If Axios behavior changes around agents/proxies, also run
`npm run test:run -- src/request.test.ts` after plan 001 exists.

## Done criteria

- [ ] High/critical `npm audit` findings are resolved or documented with
      explicit operator approval.
- [ ] `whois` remains exactly `2.14.2` in both manifest and lockfile.
- [ ] `npm run test:run`, `npm run lint`, and `npm run build` exit 0.
- [ ] No deploy-flow changes were introduced.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report if:

- `npm audit fix --force` would change `whois` away from `2.14.2`.
- Fixing high/critical findings requires `node-cron@4` migration.
- `npm ci` no longer builds because TypeScript or required types are absent
  from production dependencies.

## Maintenance notes

Keep dependency updates boring and isolated. Reviewers should check
`package-lock.json` for unintended major upgrades and confirm the `whois`
constraint documented in `AGENTS.md` still holds.
