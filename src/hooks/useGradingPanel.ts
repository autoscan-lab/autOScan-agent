"use client";

import { isToolUIPart, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  GradingRunResponse,
  InspectorView,
  ToolReport,
} from "@/components/chat/support/types";

type GradingRun = {
  runId: string;
  toolCallId: string;
};

type LatestInspectorEvent =
  | { kind: "grading"; runId: string | null; toolCallId: string }
  | { kind: "similarity"; runId: string | null; toolCallId: string }
  | { kind: "aiDetection"; runId: string | null; toolCallId: string };

type ToolReports = {
  aiDetectionReport: ToolReport | null;
  currentRun: GradingRun | undefined;
  latestEvent: LatestInspectorEvent | undefined;
  similarityReport: ToolReport | null;
};

function outputRecord(part: UIMessage["parts"][number]) {
  if (!("output" in part) || typeof part.output !== "object" || !part.output) {
    return undefined;
  }
  return part.output as Record<string, unknown>;
}

function inputRecord(part: UIMessage["parts"][number]) {
  if (!("input" in part) || typeof part.input !== "object" || !part.input) {
    return undefined;
  }
  return part.input as Record<string, unknown>;
}

function stringOf(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function toolNameOf(part: UIMessage["parts"][number]) {
  if (!isToolUIPart(part)) {
    return undefined;
  }
  return part.type === "dynamic-tool"
    ? part.toolName
    : part.type.replace(/^tool-/, "");
}

function gradingRunFromPart(part: UIMessage["parts"][number]) {
  if (!isToolUIPart(part) || part.state !== "output-available") {
    return undefined;
  }
  if (toolNameOf(part) !== "grade_submissions") {
    return undefined;
  }

  const output = outputRecord(part);
  const runId = output?.runId;
  if (typeof runId !== "string" || !runId.trim()) {
    return undefined;
  }

  return {
    runId: runId.trim(),
    toolCallId: part.toolCallId,
  };
}

function followupRunIdFromPart(part: UIMessage["parts"][number]) {
  const output = outputRecord(part);
  const input = inputRecord(part);
  return stringOf(output?.runId) ?? stringOf(input?.run_id) ?? stringOf(input?.runId);
}

function followupReportFromPart(
  part: UIMessage["parts"][number],
  expectedToolName: "check_similarity" | "check_ai_detection",
  payloadField: "similarity" | "aiDetection",
): ToolReport | undefined {
  if (!isToolUIPart(part) || part.state !== "output-available") {
    return undefined;
  }
  if (toolNameOf(part) !== expectedToolName) {
    return undefined;
  }

  const output = outputRecord(part);
  if (!output) {
    return undefined;
  }
  const payload = output[payloadField];
  if (payload === undefined || payload === null) {
    return undefined;
  }

  return {
    assignmentName: stringOf(output.assignmentName),
    payload,
    runId: followupRunIdFromPart(part),
    toolCallId: part.toolCallId,
  };
}

function latestEventFromPart(part: UIMessage["parts"][number]) {
  if (
    !isToolUIPart(part) ||
    (part.state !== "output-available" && part.state !== "output-error")
  ) {
    return undefined;
  }

  const toolName = toolNameOf(part);
  if (toolName === "check_similarity") {
    return {
      kind: "similarity" as const,
      runId: followupRunIdFromPart(part),
      toolCallId: part.toolCallId,
    };
  }
  if (toolName === "check_ai_detection") {
    return {
      kind: "aiDetection" as const,
      runId: followupRunIdFromPart(part),
      toolCallId: part.toolCallId,
    };
  }

  if (toolName !== "grade_submissions") {
    return undefined;
  }
  const run = gradingRunFromPart(part);
  if (!run) {
    return undefined;
  }
  return {
    kind: "grading" as const,
    runId: run.runId,
    toolCallId: run.toolCallId,
  };
}

function scanToolReports(messages: UIMessage[]): ToolReports {
  let currentRun: GradingRun | undefined;
  let similarityReport: ToolReport | null = null;
  let aiDetectionReport: ToolReport | null = null;
  let latestEvent: LatestInspectorEvent | undefined;

  for (
    let messageIndex = messages.length - 1;
    messageIndex >= 0;
    messageIndex--
  ) {
    const message = messages[messageIndex];
    if (message.role !== "assistant") {
      continue;
    }

    for (let partIndex = message.parts.length - 1; partIndex >= 0; partIndex--) {
      const part = message.parts[partIndex];
      const run = currentRun ? undefined : gradingRunFromPart(part);
      const similarity: ToolReport | undefined = similarityReport
        ? undefined
        : followupReportFromPart(part, "check_similarity", "similarity");
      const aiDetection: ToolReport | undefined = aiDetectionReport
        ? undefined
        : followupReportFromPart(part, "check_ai_detection", "aiDetection");
      const event = latestEvent ? undefined : latestEventFromPart(part);

      if (event) {
        latestEvent = event;
      }

      if (run) {
        currentRun = run;
      } else if (!currentRun && event?.runId) {
        currentRun = {
          runId: event.runId,
          toolCallId: event.toolCallId,
        };
      }
      if (similarity) {
        similarityReport = similarity;
      }
      if (aiDetection) {
        aiDetectionReport = aiDetection;
      }

      if (currentRun && similarityReport && aiDetectionReport && latestEvent) {
        return {
          aiDetectionReport,
          currentRun,
          latestEvent,
          similarityReport,
        };
      }
    }
  }

  return {
    aiDetectionReport,
    currentRun,
    latestEvent,
    similarityReport,
  };
}

function reportFromPanelData(
  panelData: GradingRunResponse | null,
  field: "similarityReport" | "aiDetectionReport",
  kind: string,
): ToolReport | null {
  if (!panelData) {
    return null;
  }
  const report = panelData[field];
  if (report == null) {
    return null;
  }
  return {
    assignmentName: panelData.assignmentName,
    payload: report,
    runId: panelData.runId,
    toolCallId: `stored:${kind}:${panelData.runId ?? "unknown"}`,
  };
}

export function useGradingPanel(messages: UIMessage[]) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelData, setPanelData] = useState<GradingRunResponse | null>(null);
  const [panelView, setPanelView] = useState<InspectorView>("source");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null,
  );

  const {
    aiDetectionReport,
    currentRun,
    latestEvent,
    similarityReport,
  } = useMemo(() => scanToolReports(messages), [messages]);
  const loadedRunId = useRef<string | null>(null);
  const openedToolCallId = useRef<string | null>(null);

  const refreshPanelData = useCallback(async (runId: string, targetView?: InspectorView) => {
    setPanelLoading(true);
    setPanelError(null);

    try {
      const response = await fetch(
        `/api/grading/runs/${encodeURIComponent(runId)}`,
        { method: "GET" },
      );
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail || "Could not load grading results.");
      }
      const payload = (await response.json()) as GradingRunResponse;
      loadedRunId.current = runId;
      setPanelData(payload);

      setSelectedStudentId((current) => {
        const exists = payload.students.some(
          (student) => student.studentId === current,
        );
        if (exists) {
          return current;
        }
        return payload.students[0]?.studentId ?? null;
      });

      // After data loads, switch to the target view if its report is present.
      // This handles the case where the report wasn't yet in the message scan
      // result when the panel first opened (e.g. a race where the similarity
      // report arrives via R2 rather than directly from the tool output).
      if (targetView === "similarity" && payload.similarityReport != null) {
        setPanelView("similarity");
      } else if (targetView === "aiDetection" && payload.aiDetectionReport != null) {
        setPanelView("aiDetection");
      }
    } catch (refreshError) {
      setPanelError(
        refreshError instanceof Error
          ? refreshError.message
          : "Could not load grading results.",
      );
    } finally {
      setPanelLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentRun?.runId || currentRun.runId === loadedRunId.current) {
      return;
    }
    void refreshPanelData(currentRun.runId);
  }, [currentRun?.runId, refreshPanelData]);

  // Open the panel and switch to the relevant view whenever a tool completes.
  // We call setPanelView directly (no setTimeout) to avoid a cleanup-race where
  // a React re-render between the effect and a deferred callback would cancel
  // the timeout before it fired, leaving the panel stuck on the wrong view.
  useEffect(() => {
    if (!latestEvent?.toolCallId) {
      return;
    }
    if (latestEvent.toolCallId === openedToolCallId.current) {
      return;
    }
    openedToolCallId.current = latestEvent.toolCallId;

    const eventRunId = latestEvent.runId ?? currentRun?.runId ?? null;
    const nextView =
      latestEvent.kind === "similarity"
        ? "similarity"
        : latestEvent.kind === "aiDetection"
          ? "aiDetection"
          : "source";

    setPanelView(nextView);
    setPanelOpen(true);

    // For followup tools, refresh the stored session so the fallback reports
    // are populated. refreshPanelData will re-apply the view once data loads,
    // handling cases where the report isn't yet in the message scan result.
    const runIdForRefresh = latestEvent.kind !== "grading" ? eventRunId : null;
    if (runIdForRefresh) {
      void refreshPanelData(runIdForRefresh, nextView);
    }
  }, [
    currentRun?.runId,
    latestEvent?.kind,
    latestEvent?.runId,
    latestEvent?.toolCallId,
    refreshPanelData,
  ]);

  const fallbackSimilarityReport = useMemo(
    () => reportFromPanelData(panelData, "similarityReport", "similarity"),
    [panelData],
  );

  const fallbackAiDetectionReport = useMemo(
    () => reportFromPanelData(panelData, "aiDetectionReport", "ai-detection"),
    [panelData],
  );

  const resetPanel = useCallback(() => {
    setPanelOpen(false);
    setPanelLoading(false);
    setPanelError(null);
    setPanelData(null);
    setPanelView("source");
    setSelectedStudentId(null);
    loadedRunId.current = null;
    openedToolCallId.current = null;
  }, []);

  return {
    aiDetectionReport: aiDetectionReport ?? fallbackAiDetectionReport,
    panelData,
    panelError,
    panelLoading,
    panelOpen,
    panelView,
    resetPanel,
    selectedStudentId,
    setPanelOpen,
    setSelectedStudentId,
    setPanelView,
    similarityReport: similarityReport ?? fallbackSimilarityReport,
  };
}
