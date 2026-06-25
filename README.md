# nic-tracker

Telegram bot for tracking NIC.KZ domain updates. It polls the NIC.KZ domain
listing, stores seen domains in MongoDB, enriches them with WHOIS data, and
posts updates to a configured Telegram channel.

## Requirements

- Node.js 22, matching `.nvmrc`
- MongoDB
- Telegram bot token and target channel/owner IDs

## Setup

```bash
cp .env.example .env
npm ci
```

Fill `.env` with local or server values before starting the bot. Keep real
tokens, passwords, hostnames, and IDs out of committed files.

Required variables:

- `BOT_TOKEN`
- `TG_CHANNEL_ID`
- `TG_OWNER_ID`
- `DB_HOST`
- `DB_NAME`

Optional variables:

- `DB_USER`
- `DB_PASSWORD`
- `WHOIS_SERVER`
- `WHOIS_PROXY_URL`
- `WHOIS_PROXY_PORT`

## Commands

```bash
npm run dev
npm run test:run
npm run lint
npm run build
```

`npm run dev` starts the TypeScript entry point with watch mode. `npm run build`
compiles `src/` to `dist/`, and `npm run test:run` runs the Vitest suite once.

## Deployment Notes

Server deploy should stay a simple `git pull` -> `npm ci` -> PM2 flow. Do not
add a separate manual compile step to the deploy script; `npm ci` runs
`postinstall`, and `postinstall` runs `npm run build`.

After changing PM2 config, run `npm run pm2:recreate` once so PM2 picks up the
new script path or interpreter.

Keep the `whois` package pinned exactly to `2.14.2`. Newer 2.15+ releases ship
syntax that breaks this app's current module setup.
