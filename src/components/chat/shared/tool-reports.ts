import type { ToolReport } from "@/components/chat/shared/types";

export type ToolCodeSpan = {
  endLine: number;
  startLine: number;
};

export type SimilarityPair = {
  a: string;
  b: string;
  flagged: boolean;
  id: string;
  similarity_percent: number;
  spansA: ToolCodeSpan[];
  spansB: ToolCodeSpan[];
};

export type SimilarityReport = {
  pairs: SimilarityPair[];
  source_file: string;
};

export type AIDetectionSubmission = {
  best_score: number;
  flagged: boolean;
  id: string;
  parse_error?: string;
  spans: ToolCodeSpan[];
};

export type AIDetectionReport = {
  source_file: string;
  submissions: AIDetectionSubmission[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function spanOf(value: unknown): ToolCodeSpan | null {
  if (!isRecord(value) || !isNumber(value.start_line) || !isNumber(value.end_line)) {
    return null;
  }

  return {
    endLine: Math.max(1, Math.floor(value.end_line)),
    startLine: Math.max(1, Math.floor(value.start_line)),
  };
}

function spansFrom(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((span) => {
    const parsed = spanOf(span);
    return parsed ? [parsed] : [];
  });
}

function similaritySpans(pair: Record<string, unknown>, key: "spans_a" | "spans_b") {
  if (!Array.isArray(pair.matches)) return [];

  return pair.matches.flatMap((match) => {
    if (!isRecord(match)) return [];
    return spansFrom(match[key]);
  });
}

function aiDetectionSpans(submission: Record<string, unknown>) {
  if (!Array.isArray(submission.matches)) return [];

  return submission.matches.flatMap((match) => {
    if (!isRecord(match)) return [];
    return spansFrom(match.spans);
  });
}

export function similarityPairId(pair: Pick<SimilarityPair, "a" | "b">) {
  return `${pair.a}::${pair.b}`;
}

export function similarityReportOf(report: ToolReport | null): SimilarityReport | null {
  if (!report || !isRecord(report.payload)) return null;

  const payload = report.payload;
  if (typeof payload.source_file !== "string" || !Array.isArray(payload.pairs)) {
    return null;
  }

  const pairs = payload.pairs.flatMap((pair): SimilarityPair[] => {
    if (
      !isRecord(pair) ||
      typeof pair.a !== "string" ||
      typeof pair.b !== "string" ||
      typeof pair.flagged !== "boolean" ||
      !isNumber(pair.similarity_percent)
    ) {
      return [];
    }

    return [{
      a: pair.a,
      b: pair.b,
      flagged: pair.flagged,
      id: similarityPairId({ a: pair.a, b: pair.b }),
      similarity_percent: pair.similarity_percent,
      spansA: similaritySpans(pair, "spans_a"),
      spansB: similaritySpans(pair, "spans_b"),
    }];
  });

  return pairs.length === payload.pairs.length
    ? { pairs, source_file: payload.source_file }
    : null;
}

export function selectedSimilarityPair(
  report: ToolReport | null,
  selectedId: string | null,
) {
  if (!selectedId) return null;
  return similarityReportOf(report)?.pairs.find((pair) => pair.id === selectedId) ?? null;
}

export function aiDetectionReportOf(
  report: ToolReport | null,
): AIDetectionReport | null {
  if (!report || !isRecord(report.payload)) return null;

  const payload = report.payload;
  if (
    typeof payload.source_file !== "string" ||
    !isNumber(payload.dictionary_entry_count) ||
    !isNumber(payload.dictionary_usable) ||
    !Array.isArray(payload.submissions)
  ) {
    return null;
  }

  const submissions = payload.submissions.flatMap(
    (submission): AIDetectionSubmission[] => {
      if (
        !isRecord(submission) ||
        typeof submission.id !== "string" ||
        typeof submission.flagged !== "boolean" ||
        !isNumber(submission.best_score)
      ) {
        return [];
      }

      return [{
        best_score: submission.best_score,
        flagged: submission.flagged,
        id: submission.id,
        parse_error: optionalString(submission.parse_error),
        spans: aiDetectionSpans(submission),
      }];
    },
  );

  return submissions.length === payload.submissions.length
    ? { source_file: payload.source_file, submissions }
    : null;
}

export function selectedAiDetectionSubmission(
  report: ToolReport | null,
  selectedId: string | null,
) {
  if (!selectedId) return null;
  return aiDetectionReportOf(report)?.submissions.find(
    (submission) => submission.id === selectedId,
  ) ?? null;
}
