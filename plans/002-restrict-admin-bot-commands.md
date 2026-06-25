# Plan 002: Restrict administrative bot commands to the owner

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c027afb..HEAD -- src/bot.ts src/env.ts src/bot.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/001-add-critical-characterization-tests.md`
- **Category**: security
- **Planned at**: commit `c027afb`, 2026-06-24

## Why this matters

`/proxy`, `/disableproxy`, and `/getproxy` are administrative commands. Today
there is no owner check, so any Telegram user who can reach the bot can change
the NIC scraping proxy or read the current proxy setting. The project already
requires `TG_OWNER_ID`, so the intended authorization boundary is available.

## Current state

Relevant files:

- `src/bot.ts` registers all Telegram commands.
- `src/env.ts` exposes required environment variables, including owner id.
- `src/bot.test.ts` should exist after plan 001 and should be extended here.

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
```

```ts
// src/bot.ts:33-44
bot.command('disableproxy', async (ctx) => {
  await updateSettings('');
  await ctx.reply('Прокси успешно отключена');
  const instance = await getInstance();
  parseNic(instance);
});

bot.command('getproxy', async (ctx) => {
  const database = await getDb();
```

```ts
// src/env.ts:18-22
get tgChannelId(): string {
  return required('TG_CHANNEL_ID');
},
get tgOwnerId(): string {
  return required('TG_OWNER_ID');
},
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Focused tests | `npm run test:run -- src/bot.test.ts` | exit 0 |
| Full tests | `npm run test:run` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:
- `src/bot.ts`
- `src/bot.test.ts`

**Out of scope**:
- Do not change public `/start` behavior.
- Do not restrict `/whois` unless the operator explicitly asks; this plan is
  only for administrative commands.
- Do not change env variable names.
- Do not print or expose proxy URLs in logs.

## Git workflow

- Branch: `codex/002-owner-only-admin-commands`
- Commit style: conventional commits, for example
  `fix(bot): restrict admin commands to owner`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add tests for non-owner rejection

Extend `src/bot.test.ts` so each administrative command has a non-owner case:

- `/proxy http://proxy.example:8080`
- `/disableproxy`
- `/getproxy`

Mock or stub `env.tgOwnerId` as `"1001"`. Build fake Telegraf contexts with
`from.id` set to a different number, for example `2002`. Assert:

- `updateSettings` is not called.
- `getDb` is not called.
- `getInstance` is not called.
- `parseNic` is not called.
- The command replies with a short denial message.

**Verify**: `npm run test:run -- src/bot.test.ts` -> fails before the fix
because commands are currently public. Keep the failing tests and proceed.

### Step 2: Add a small owner guard in `src/bot.ts`

Create a helper near the top of `src/bot.ts`, for example:

```ts
function isOwner(ctx: { from?: { id?: number } }): boolean {
  return ctx.from?.id?.toString() === env.tgOwnerId;
}
```

You will need to import `env` from `./env.js`. Use this helper at the start of
`proxy`, `disableproxy`, and `getproxy`. For unauthorized users, reply with a
generic denial and return before touching DB or parser dependencies.

Do not depend on `ctx.chat.id`; command authorization should be based on the
sender id (`ctx.from.id`), not the chat.

**Verify**: `npm run test:run -- src/bot.test.ts` -> exit 0.

### Step 3: Add owner happy-path tests

For each admin command, ensure existing happy-path tests use `from.id` equal to
`env.tgOwnerId` and still pass. This prevents the guard from blocking the
owner.

**Verify**: `npm run test:run -- src/bot.test.ts` -> exit 0.

### Step 4: Run the full gate

**Verify**:
- `npm run test:run` -> exit 0.
- `npm run lint` -> exit 0.
- `npm run build` -> exit 0.

## Optional real validation

If the operator wants production validation, use `ssh root@drugoi.xyz` only
after the code is deployed. Send the bot command from a non-owner Telegram user
and confirm it is denied. Do not read or print `.env`, bot token, or DB
credentials from the server.

## Test plan

Extend `src/bot.test.ts` from plan 001. Cases:

- Owner can run `/proxy`, `/disableproxy`, and `/getproxy`.
- Non-owner is denied for each of those commands.
- Non-owner attempts do not call DB, request, or parser functions.

## Done criteria

- [ ] Admin commands check `ctx.from.id` against `env.tgOwnerId`.
- [ ] `/start` and `/whois` behavior is unchanged.
- [ ] Non-owner tests prove no DB/request/parser side effects occur.
- [ ] `npm run test:run`, `npm run lint`, and `npm run build` exit 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report if:

- `ctx.from.id` is unavailable in the Telegraf context type without a broader
  command abstraction.
- Tests from plan 001 do not exist and cannot be added quickly.
- The operator says `/whois` must also be owner-only; that is a scope change.

## Maintenance notes

Any future command that mutates settings, sends operational data, or triggers
parser runs should reuse the same owner guard. Reviewers should check for new
unguarded `bot.command(...)` handlers after this lands.
