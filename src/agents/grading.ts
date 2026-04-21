import { groq } from "@ai-sdk/groq";
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

const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile" as const;

const baseInstructions = `You are autOScan, a grading assistant for university programming courses.
Help users grade student submission zip files, review individual results, adjust grades, and export reports.

When a zip file is attached and the user gives an assignment name, call grade_submissions. You do not need to ask for a URL; uploaded attachments are available to the tool automatically.
If the assignment name is missing, ask for it before grading.
Format student lists as compact markdown tables.
When export_grades returns a download_url, present it as a markdown download link.
Keep responses direct and practical.`;

export const createGradingAgent = (options?: {
  instructions?: string;
}): Agent<GradingContext> => {
  return new Agent<GradingContext>({
    instructions: options?.instructions ?? baseInstructions,
    model: aisdk(groq(DEFAULT_GROQ_MODEL)),
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
