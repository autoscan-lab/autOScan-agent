import type { UIMessage } from "ai";

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

export type StudentInspectorRow = {
  studentId: string;
  status: string | null;
  grade: number | null;
  compileOk: boolean | null;
  testsPassed: string | null;
  bannedCount: number | null;
  notes: string | null;
  sourceText: string | null;
};

export type GradingRunResponse = {
  assignmentName: string | null;
  students: StudentInspectorRow[];
};

export type ZipPromptMessage = {
  files: File[];
  text: string;
};
