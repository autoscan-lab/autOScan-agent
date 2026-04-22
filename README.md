<h1 align="center">autOScan-agent</h1>

<p align="center">
  <strong>Web chat for autOScan grading with a tool-calling agent.</strong>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/next.js-16-000000?style=flat&logo=nextdotjs&logoColor=white" /></a>
  <a href="#"><img src="https://img.shields.io/badge/react-19-61DAFB?style=flat&logo=react&logoColor=111111" /></a>
  <a href="#"><img src="https://img.shields.io/badge/license-MIT-24292e?style=flat" /></a>
</p>

---

## What It Does

`autOScan-agent` is a Next.js app: Google sign-in, chat, zip upload, inline grading. The server agent lives at `src/app/api/chat/route.ts` (OpenAI Agents SDK) and uses Groq (Llama 3.3 70B) plus your **autOScan-engine** for `/setup` and `/grade`. Chat state in MongoDB; uploads and exports in Cloudflare R2. UI tokens are described in `docs/DESIGN.md`.

---

## Features

- Grading, student list/detail, manual grade bump, Excel export via agent tools
- Attachments to R2; latest run + export metadata in the same bucket
- Durable chat id + messages (Mongo) so sessions survive reloads

---

## Installation

- Node 20+ (`package.json` `engines.node`)
- `pnpm` (repo uses `pnpm-lock.yaml`)

```bash
pnpm install
```

---

## Configuration

Copy `.env.example` → `.env` and set at least:

| Area | Variables |
|------|------------|
| Auth | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `ALLOWED_EMAILS` |
| Model | `GROQ_API_KEY` |
| Engine | `ENGINE_URL`, `ENGINE_SECRET` |
| R2 | `R2_*`, `R2_APP_PREFIX` |
| DB | `MONGODB_URI`, `MONGODB_DB_NAME` |

---

## Quickstart

1. `cp .env.example .env` and fill the table above.
2. `pnpm dev` → [http://localhost:3000](http://localhost:3000)

---

## R2 layout

With `R2_APP_PREFIX` (default `web`):

```text
web/uploads/<user-hash>/<run-id>/<file>.zip
web/runs/<user-hash>/<run-id>.json
web/users/<user-hash>/latest.json
web/exports/<user-hash>/<export-id>.json
web/exports/<user-hash>/<export-id>/<file>.xlsx
```

---

## Scripts

```bash
pnpm typecheck
pnpm lint
pnpm build
```

---

## License

MIT
