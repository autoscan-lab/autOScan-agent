import type { FileUIPart, UIMessage } from "ai";
import type { GradingRunSummary, StudentRow } from "@/lib/grading";

export type ChatProps = {
  initialChatId?: string;
  initialMessages?: UIMessage[];
  userEmail?: string | null;
  userName?: string | null;
};

export type UploadResponse = {
  filename?: string;
  mediaType?: string;
  url: string;
};

export type StudentInspectorRow = StudentRow;

export type GradingRunResponse = GradingRunSummary;

export type ZipPromptMessage = {
  files: FileUIPart[];
  text: string;
};
