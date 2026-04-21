# WhatsApp to Web Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Python WhatsApp agent with a Next.js 16 Google-authenticated web chat app that runs the OpenAI Agents SDK in API routes and calls the existing Fly.io engine.

**Architecture:** A Next.js App Router app owns auth, UI, and the agent loop. The API route streams Agents SDK output through the official AI SDK UI stream helper. Engine calls stay behind typed tools with bearer-token authentication.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, NextAuth 5, OpenAI Agents SDK TypeScript, OpenAI Agents extensions AI SDK adapter, Vercel AI SDK, Groq provider, Zod 4.

---

### Task 1: Remove Python Runtime

**Files:**
- Delete: legacy Python `app/`
- Delete: `requirements.txt`
- Delete: `Dockerfile`
- Delete: `fly.toml`
- Delete: `Makefile`
- Delete: `.dockerignore`

- [ ] Remove the Python agent, WhatsApp webhook, local Excel export, and Fly.io agent deployment files.
- [ ] Keep `.env` untouched and update `.env.example` for the new app secrets.

### Task 2: Scaffold Next.js 16

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `postcss.config.mjs`
- Create: `eslint.config.mjs`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

- [ ] Install Next.js 16, React 19, TypeScript, Tailwind CSS 4, ESLint, and app dependencies.
- [ ] Run `pnpm dlx getdesign@latest add revolut` and apply/use its generated `docs/DESIGN.md` guidance.
- [ ] Run `pnpm dlx shadcn@latest init` and `pnpm dlx ai-elements@latest add conversation message prompt-input tool chain-of-thought code-block` if the CLIs run non-interactively in this repo.

### Task 3: Implement Auth Boundary

**Files:**
- Create: `src/auth.ts`
- Create: `src/proxy.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

- [ ] Configure Google OAuth provider.
- [ ] Restrict sign-in to comma-separated `ALLOWED_EMAILS`.
- [ ] Protect pages and `/api/chat`, excluding Next static assets and auth callbacks.

### Task 4: Implement Agent and Engine Tools

**Files:**
- Create: `src/agents/tools.ts`
- Create: `src/agents/grading.ts`
- Create: `src/lib/message-converters.ts`

- [ ] Create `grade_submissions`, `list_students`, `show_student`, `bump_grade`, and `export_grades` function tools.
- [ ] Use `aisdk(groq("llama-3.3-70b-versatile"))` for the agent model.
- [ ] Convert latest AI SDK `UIMessage` parts into Agents SDK input items.

### Task 5: Implement Streaming Chat API

**Files:**
- Create: `src/app/api/chat/route.ts`

- [ ] Authenticate with `auth()`.
- [ ] Parse `messages` from request JSON.
- [ ] Run the agent with `{ stream: true, context: { userId } }`.
- [ ] Return `createAiSdkUiMessageStreamResponse(stream)`.

### Task 6: Implement Chat UI

**Files:**
- Create: `src/components/Chat.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] Use `useChat` from `@ai-sdk/react` with local input state.
- [ ] Render text, markdown tables, tool parts, reasoning parts, and errors.
- [ ] Provide an upload affordance and explain that uploaded files need an engine-reachable URL until storage is added.
- [ ] Style with the Revolut design direction and Tailwind CSS variables.

### Task 7: Verify

**Files:**
- Modify as needed based on failures.

- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm build`.
- [ ] Fix all blocking failures and rerun the failing command.
