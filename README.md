<h1 align="center">autOScan-agent</h1>

<p align="center">
  <strong>Agentic web chat for autOScan grading.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/next.js-16-000000?style=flat&logo=nextdotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/react-19-61DAFB?style=flat&logo=react&logoColor=111111" />
  <img src="https://img.shields.io/badge/license-MIT-24292e?style=flat" />
</p>

---

## Overview

`autOScan-agent` is a Next.js web chat app. Users sign in with Google, chat with the grading assistant, attach a submissions zip, and receive grading results inline.

The app runs the OpenAI Agents SDK TypeScript loop directly in `src/app/api/chat/route.ts`. Groq serves Llama 3.3 70B through the AI SDK adapter, and tool calls reach the existing `autOScan-engine` Fly.io machine.

## Stack

- Next.js 16 App Router on Node.js runtime
- React 19 + Tailwind CSS 4
- Auth.js / NextAuth 5 with Google OAuth
- OpenAI Agents SDK TypeScript
- `@openai/agents-extensions/ai-sdk` and `ai-sdk-ui`
- Groq Llama 3.3 70B via `@ai-sdk/groq`
- AI Elements + shadcn/ui components
- Cloudflare R2 for durable uploads, grading sessions, and Excel exports
- Revolut-inspired `docs/DESIGN.md` theme

## Engine Compatibility

The current tool layer supports the existing engine API:

- `POST /setup/{assignment}`
- `POST /grade` with multipart `file`

The web app stores uploads, latest grading sessions, manual grade bumps, and Excel exports in Cloudflare R2 under `R2_APP_PREFIX` so Vercel serverless restarts do not erase grading state.

Default R2 object layout:

```text
web/
  uploads/<user-hash>/<run-id>/submissions.zip
  runs/<user-hash>/<run-id>.json
  users/<user-hash>/latest.json
  exports/<user-hash>/<export-id>.json
  exports/<user-hash>/<export-id>/<filename>.xlsx
```

## Local Setup

1. Copy `.env.example` to `.env` and fill in the values.
2. Install dependencies with `pnpm install`.
3. Run `pnpm dev`.
4. Open `http://localhost:3000`.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```



## License

MIT
