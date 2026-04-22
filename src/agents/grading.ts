import { groq } from "@ai-sdk/groq";
import type { ModelSettings } from "@openai/agents";
import { Agent } from "@openai/agents";
import { aisdk } from "@openai/agents-extensions/ai-sdk";

import {
  gradeSubmissions,
  type GradingContext,
} from "./tools";

/**
 * Groq can return `Failed to call a function` / `failed_generation` when tool
 * argument generation drifts. Keep tool calls deterministic and serialized.
 */
const groqModelSettings: ModelSettings = {
  temperature: 0.2,
  providerData: {
    providerOptions: {
      groq: {
        parallelToolCalls: false,
        structuredOutputs: false,
        strictJsonSchema: false,
      },
    },
  },
};

const baseInstructions = `You are autOScan, a grading assistant for university programming courses.
Help users grade student submission zip files.

Tools:
- grade_submissions(assignment_name): runs the grader on the user's attached zip.

Tool-use rules — follow strictly:
- Do NOT call a tool unless it is clearly needed for the current user request.
- Do NOT call grade_submissions if the latest user message has no attached zip file. Instead reply in plain text and ask the user to attach one.
- Do NOT call grade_submissions without an explicit assignment name from the user. If missing, ask for it.
- Call each tool at most once per user turn.
- Never call a tool just to double-check a result you already received.

Response style:
- After grading, summarize the run in 1-2 sentences and format students as a compact markdown table (studentId, status, grade).
- Keep responses direct and practical.`;

export const createGradingAgent = (options?: {
  instructions?: string;
}): Agent<GradingContext> => {
  return new Agent<GradingContext>({
    instructions: options?.instructions ?? baseInstructions,
    model: aisdk(groq("llama-3.3-70b-versatile")),
    modelSettings: groqModelSettings,
    name: "GradingAssistant",
    tools: [gradeSubmissions],
  });
};

export const gradingAgent = createGradingAgent();
