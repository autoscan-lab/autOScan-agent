@AGENTS.md

## Project SDK Architecture

- Chat streaming and UI message transport use the **AI SDK** (`ai`, `@ai-sdk/react`).
- Agent orchestration (instructions, tool execution, run lifecycle) uses the **OpenAI Agents SDK** (`@openai/agents`).
- The glue layer is `@openai/agents-extensions` (`ai-sdk`, `ai-sdk-ui`).
