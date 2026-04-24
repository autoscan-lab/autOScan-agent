"use client";

import { isToolUIPart, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { GradingRunResponse } from "@/components/chat/support/types";

function outputRecord(part: UIMessage["parts"][number]) {
  if (!("output" in part) || typeof part.output !== "object" || !part.output) {
    return undefined;
  }
  return part.output as Record<string, unknown>;
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

function latestGradingRun(messages: UIMessage[]) {
  for (
    let messageIndex = messages.length - 1;
    messageIndex >= 0;
    messageIndex--
  ) {
    const message = messages[messageIndex];
    if (message.role !== "assistant") {
      continue;
    }

    for (
      let partIndex = message.parts.length - 1;
      partIndex >= 0;
      partIndex--
    ) {
      const run = gradingRunFromPart(message.parts[partIndex]);
      if (run) {
        return run;
      }
    }
  }

  return undefined;
}

export function useGradingPanel(messages: UIMessage[]) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelData, setPanelData] = useState<GradingRunResponse | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null,
  );

  const currentRun = useMemo(() => latestGradingRun(messages), [messages]);
  const loadedRunId = useRef<string | null>(null);
  const openedToolCallId = useRef<string | null>(null);

  const refreshPanelData = useCallback(async (runId: string) => {
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

  useEffect(() => {
    if (!currentRun?.toolCallId) {
      return;
    }
    if (currentRun.toolCallId === openedToolCallId.current) {
      return;
    }
    openedToolCallId.current = currentRun.toolCallId;
    setPanelOpen(true);
  }, [currentRun?.toolCallId]);

  const resetPanel = useCallback(() => {
    setPanelOpen(false);
    setPanelLoading(false);
    setPanelError(null);
    setPanelData(null);
    setSelectedStudentId(null);
    loadedRunId.current = null;
    openedToolCallId.current = null;
  }, []);

  return {
    panelData,
    panelError,
    panelLoading,
    panelOpen,
    resetPanel,
    selectedStudentId,
    setPanelOpen,
    setSelectedStudentId,
  };
}
