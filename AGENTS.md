<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project SDK Architecture

- Chat streaming and client chat state use the **AI SDK** (`ai`, `@ai-sdk/react`).
- Agent orchestration (instructions, tools, runs) uses the **OpenAI Agents SDK** (`@openai/agents`).
- Integration between both layers uses `@openai/agents-extensions` (`ai-sdk`, `ai-sdk-ui`).
