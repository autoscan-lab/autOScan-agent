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

`autOScan-agent` is a web chat app for running autOScan grades without leaving the browser.  
Sign in with Google, upload a submissions zip, provide the assignment name, and the assistant runs the grader and returns a clean results summary in chat.  
Chat history is saved in MongoDB, and uploaded files plus grading run metadata are stored in Cloudflare R2.

---

## SDK Architecture

- **AI SDK** (`ai`, `@ai-sdk/react`) handles chat UX and streaming message transport.
- **OpenAI Agents SDK** (`@openai/agents`) handles agent orchestration, instructions, tool calling, and run lifecycle.
- The bridge is provided by `@openai/agents-extensions` (`ai-sdk`, `ai-sdk-ui`) so agent runs stream into AI SDK UI messages.

---

## Features

- Single tool surface for grading: `grade_submissions(assignment_name)`
- Grading from attached zip files in chat
- Compact markdown results table (`studentId`, `status`, `grade`)
- Durable chat id + messages in MongoDB (sessions survive reloads)
- Run artifacts in R2 (uploads + latest run pointer per user)

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
```

`latest.json` is a pointer to the newest run id for that user.

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
