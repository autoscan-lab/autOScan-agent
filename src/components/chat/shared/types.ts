import type { FileUIPart, UIMessage } from "ai";
import type { GradingRunSummary, StudentRow } from "@/lib/grading";

export type ChatProps = {
  initialChatId?: string;
  initialMessages?: UIMessage[];
  userEmail?: string | null;
  userImage?: string | null;
  userName?: string | null;
};

export type UploadResponse = {
  filename?: string;
  mediaType?: string;
  url: string;
};

export type StudentResultRow = StudentRow;

export type GradingRunResponse = GradingRunSummary;

export type ToolReport = {
  assignmentName: string | null;
  payload: unknown;
  runId: string | null;
  toolCallId: string;
};

export type ZipPromptMessage = {
  files: FileUIPart[];
  text: string;
};
