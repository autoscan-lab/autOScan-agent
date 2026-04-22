import { groq } from "@ai-sdk/groq";
import type { ModelSettings } from "@openai/agents";
import { Agent } from "@openai/agents";
import { aisdk } from "@openai/agents-extensions/ai-sdk";

import {
  bumpGrade,
  exportGrades,
  gradeSubmissions,
  listStudents,
  showStudent,
  type GradingContext,
} from "./tools";

/**
 * Groq + `@ai-sdk/groq` default to strict JSON for tools; the API can then
 * reject tool calls with `Failed to call a function` / `failed_generation`.
 * These flags match a looser request body so Llama can recover from small schema mismatches.
 */
const groqModelSettings: ModelSettings = {
  providerData: {
    providerOptions: {
      groq: {
        strictJsonSchema: false,
        structuredOutputs: false,
      },
    },
  },
};

const baseInstructions = `You are autOScan, a grading assistant for university programming courses.
Help users grade student submission zips, review individual results, adjust grades, and export reports.

Tools:
- grade_submissions(assignment_name): runs the grader on the user's attached zip.
- list_students(): lists students from the latest run.
- show_student(student_id): returns details for one student from the latest run.
- bump_grade(student_id, new_grade, reason): overrides a student grade.
- export_grades(): returns a downloadable Excel file.

Tool-use rules — follow strictly:
- Do NOT call a tool unless it is clearly needed for the current user request.
- Do NOT call grade_submissions if the latest user message has no attached zip file. Instead reply in plain text and ask the user to attach one.
- Do NOT call grade_submissions without an explicit assignment name from the user. If missing, ask for it.
- Call each tool at most once per user turn. After grade_submissions returns, do not call grade_submissions or list_students again in the same turn — use the data it already returned.
- Never call a tool just to double-check a result you already received.

Response style:
- After grading, summarize the run in 1-2 sentences and format the students as a compact markdown table (studentId, status, grade).
- When export_grades returns a downloadUrl, present it as a markdown download link.
- Keep responses direct and practical.`;

export const createGradingAgent = (options?: {
  instructions?: string;
}): Agent<GradingContext> => {
  return new Agent<GradingContext>({
    instructions: options?.instructions ?? baseInstructions,
    model: aisdk(groq("llama-3.3-70b-versatile")),
    modelSettings: groqModelSettings,
    name: "GradingAssistant",
    tools: [
      gradeSubmissions,
      listStudents,
      showStudent,
      bumpGrade,
      exportGrades,
    ],
  });
};

export const gradingAgent = createGradingAgent();
