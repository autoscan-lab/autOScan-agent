# WhatsApp to Agentic Web Chat Design

## Goal
Migrate `autOScan-agent` from a Python WhatsApp/FastAPI agent into a Next.js 16 web chat app hosted on Vercel, using Google sign-in and the OpenAI Agents SDK TypeScript runtime directly inside API routes.

## Architecture
The browser renders an authenticated chat UI. NextAuth protects pages and `/api/chat`; approved Google users can send messages through AI SDK `useChat`. The `/api/chat` route converts UI messages into Agents SDK input, streams a `run(gradingAgent, ..., { stream: true })` result, and returns it through `createAiSdkUiMessageStreamResponse` so the UI receives text, reasoning, and tool chunks without custom SSE handling.

The agent uses Groq Llama 3.3 70B through `@openai/agents-extensions/ai-sdk` and exposes function tools that call the existing Fly.io grading engine. The Python agent, WhatsApp webhook, local Excel writer, Fly config, and Docker deployment are removed from this repo.

## Components
- `src/agents/tools.ts`: typed function tools and shared authenticated engine fetch helper.
- `src/agents/grading.ts`: `GradingAssistant` agent definition and Groq model adapter.
- `src/app/api/chat/route.ts`: authenticated streaming API endpoint using Node.js runtime.
- `src/auth.ts` and `src/proxy.ts`: Google OAuth auth and route protection for Next.js 16.
- `src/components/Chat.tsx`: client chat UI using AI SDK `useChat` and AI Elements-compatible rendering.
- `src/app/globals.css`: Tailwind v4 theme layer, updated by the Revolut `getdesign` system where available.

## Data Flow
1. User signs in with Google.
2. `src/proxy.ts` and `auth()` reject unauthenticated requests.
3. The chat form calls `sendMessage` from `@ai-sdk/react`.
4. `/api/chat` validates the session and message payload.
5. UI messages are converted into Agents SDK user/assistant/system input items.
6. `run()` executes the agent loop and tool calls.
7. Tool calls POST JSON to `ENGINE_URL` using `ENGINE_SECRET`.
8. The stream helper translates Agents SDK stream events into AI SDK UI chunks.

## Error Handling
- Unauthenticated requests return `401`.
- Empty chat requests return `400`.
- Missing engine configuration fails tool calls with a clear error for the model to summarize.
- Non-2xx engine responses surface status and response text.
- Chat UI displays API errors inline.

## Version Decisions
- Use Next.js 16 because this is a new app and current official docs treat it as the default migration target.
- Use `src/proxy.ts`, not `middleware.ts`, because `middleware.ts` is deprecated in Next.js 16.
- Use `@ai-sdk/react` and local input state because the latest AI SDK removed the old `ai/react` managed input pattern.
- Use Zod v4 because the current OpenAI Agents SDK TypeScript docs require it.

## Testing
- TypeScript compilation through `pnpm typecheck`.
- Production build through `pnpm build`.
- Manual smoke flow after secrets are configured: Google sign-in, allowlist rejection, simple chat, grading tool call, export link.
