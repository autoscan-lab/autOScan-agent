<h1 align="center">autOScan-agent</h1>

<p align="center">
  <strong>Web agent that helps you grade in a single conversation.</strong>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/next.js-16-000000?style=flat&logo=nextdotjs&logoColor=white" /></a>
  <a href="#"><img src="https://img.shields.io/badge/react-19-61DAFB?style=flat&logo=react&logoColor=111111" /></a>
  <a href="#"><img src="https://img.shields.io/badge/license-MIT-24292e?style=flat" /></a>
</p>

---

## What It Does

`autOScan-agent` is a web agent that sits in front of the autOScan engine ([autoscan-lab/autoscan-engine](https://github.com/autoscan-lab/autoscan-engine)). The engine is where grading and follow-up analysis actually run. The agent is how you drive that work in a conversation.

You attach the submissions, mention the assignment and keep the conversation in one thread. Ask for similarity or AI-detection checks when that makes sense for the batch you just ran.

---

## SDK Architecture

- **AI SDK** (`ai`, `@ai-sdk/react`) handles chat UX and streaming message transport.
- **OpenAI Agents SDK** (`@openai/agents`) handles agent orchestration, instructions, tool calling, and run lifecycle.
- The bridge is provided by `@openai/agents-extensions` (`ai-sdk`, `ai-sdk-ui`) so agent runs stream into AI SDK UI messages.

---

## Features

- Agent tools: `grade_submissions`, `check_similarity` and `check_ai_detection`
- Grading from attached zip files in chat
- Durable chat id + messages in MongoDB
- Run artifacts in R2

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
