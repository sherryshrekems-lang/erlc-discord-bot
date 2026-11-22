# CountyLink

A public, self-hostable Discord bot and web dashboard for Roblox **Emergency Response: Liberty County** communities.

## Features

- Discord OAuth login and guild selection
- Per-server dashboard configuration
- Slash commands: `/ping`, `/settings`, `/server`, `/link`, `/reload`, `/help`
- ER:LC server status lookup through a configurable API base URL
- Moderation logging, member counts, and role/department assignment channels
- Original dark CountyLink visual identity and dashboard
- SQLite storage with no external database required
- Docker support

## Quick start

```bash
npm install
cp .env.example .env
npm run deploy
npm start
```

Run the web dashboard separately:

```bash
npm run web
```

## Required environment variables

Copy `.env.example` and fill in:

- `DISCORD_TOKEN` — bot token
- `DISCORD_CLIENT_ID` — Discord application ID
- `DISCORD_CLIENT_SECRET` — OAuth client secret
- `DISCORD_REDIRECT_URI` — OAuth callback (default: `http://localhost:3000/auth/callback`)
- `SESSION_SECRET` — random long secret used for dashboard sessions
- `PUBLIC_URL` — public site URL

Optional:

- `PORT` — web server port (default `3000`)
- `ERLC_API_BASE_URL` — ER:LC-compatible JSON API base URL
- `DATABASE_PATH` — SQLite file location (default: `./data/config.db`)

Never commit real secrets. Invite the bot with the permissions you need at Discord Developer Portal → OAuth2 → URL Generator.

## ER:LC API

The `/server` command expects your API endpoint to return JSON. It first attempts `${ERLC_API_BASE_URL}/servers/:id`, then `${ERLC_API_BASE_URL}/server/:id`. A plain object or `{ data: ... }` is accepted.

CountyLink is an independent project and is not affiliated with Roblox or ER:LC.
