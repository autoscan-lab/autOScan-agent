"use client";

import {
  FileArchiveIcon,
  PaperclipIcon,
  SendIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { ZipPromptMessage } from "./types";

export type ZipPromptInputProps = {
  accept: string;
  busy: boolean;
  maxFileSize: number;
  onError: (message: string | null) => void;
  onStop: () => void;
  onSubmit: (message: ZipPromptMessage) => Promise<void>;
};

type SelectedFile = {
  file: File;
  id: string;
};

function fileMatchesAccept(file: File, accept: string) {
  const patterns = accept
    .split(",")
    .map((pattern) => pattern.trim().toLowerCase())
    .filter(Boolean);
  const filename = file.name.toLowerCase();
  const mediaType = file.type.toLowerCase();

  return patterns.some((pattern) => {
    if (pattern.startsWith(".")) {
      return filename.endsWith(pattern);
    }
    return mediaType === pattern;
  });
}

export function ZipPromptInput({
  accept,
  busy,
  maxFileSize,
  onError,
  onStop,
  onSubmit,
}: ZipPromptInputProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const incoming = [...fileList];
      if (incoming.length === 0) {
        return;
      }

      const zip = incoming.find((file) => fileMatchesAccept(file, accept));
      if (!zip) {
        onError("Only .zip files are supported.");
        return;
      }
      if (zip.size > maxFileSize) {
        onError("Zip file is too large (max 12 MB).");
        return;
      }

      onError(null);
      setFiles([{ file: zip, id: crypto.randomUUID() }]);
    },
    [accept, maxFileSize, onError],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedText = text.trim();
      if (!trimmedText && files.length === 0) {
        return;
      }

      setSubmitting(true);
      try {
        await onSubmit({
          files: files.map((item) => item.file),
          text: trimmedText,
        });
        setText("");
        setFiles([]);
        onError(null);
      } catch {
        // Keep the draft and attachment in place so the user can retry.
      } finally {
        setSubmitting(false);
      }
    },
    [files, onError, onSubmit, text],
  );

  const disabled = busy || submitting;

  return (
    <form className="w-full" onSubmit={handleSubmit}>
      <input
        accept={accept}
        aria-label="Upload submissions zip"
        className="hidden"
        onChange={(event) => {
          if (event.currentTarget.files) {
            addFiles(event.currentTarget.files);
          }
          event.currentTarget.value = "";
        }}
        ref={fileInputRef}
        type="file"
      />

      <div className="overflow-hidden rounded-xl border border-[var(--linear-border)] bg-[var(--linear-panel)] shadow-[0_12px_32px_-12px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.02)] transition-[border-color,box-shadow] duration-150 focus-within:border-[var(--linear-border-solid)] focus-within:shadow-[0_0_0_1px_rgba(113,112,255,0.22),0_12px_32px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.03)]">
        {files.length > 0 ? (
          <div className="flex flex-wrap gap-1 px-3 pt-3">
            {files.map((item) => (
              <span
                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[var(--linear-border)] bg-[var(--linear-ghost)] px-2 py-1 font-mono text-[11px] text-[var(--chat-text-secondary)]"
                key={item.id}
              >
                <FileArchiveIcon className="size-3.5 shrink-0" />
                <span className="truncate">{item.file.name}</span>
                <button
                  aria-label="Remove attachment"
                  className="inline-flex size-4 items-center justify-center rounded-sm text-[var(--chat-text-muted)] transition-colors hover:bg-[var(--linear-ghost-hover)] hover:text-[var(--foreground)]"
                  onClick={() => setFiles([])}
                  type="button"
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <textarea
          className="field-sizing-content max-h-56 min-h-[84px] w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--chat-text-muted)] focus-visible:ring-0 focus-visible:ring-offset-0"
          disabled={disabled}
          name="message"
          onChange={(event) => setText(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) {
              return;
            }
            if (event.nativeEvent.isComposing) {
              return;
            }
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }}
          placeholder="Attach a zip and ask for grading..."
          value={text}
        />

        <div className="flex items-center justify-between gap-1 px-3 pb-2.5">
          <button
            aria-label="Attach zip"
            className="inline-flex size-8 items-center justify-center rounded-md text-[var(--chat-text-muted)] transition-colors hover:bg-[var(--linear-ghost-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <PaperclipIcon className="size-4" />
          </button>

          <button
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-md border border-transparent bg-primary text-primary-foreground shadow-[var(--shadow-ring)] transition-colors hover:bg-[var(--linear-accent-hover)] disabled:opacity-50",
              busy &&
                "bg-[var(--linear-surface-hover)] hover:bg-[var(--linear-surface-hover)]",
            )}
            disabled={submitting}
            onClick={busy ? onStop : undefined}
            type={busy ? "button" : "submit"}
          >
            {busy ? (
              <SquareIcon className="size-4" />
            ) : (
              <SendIcon className="size-4" />
            )}
            <span className="sr-only">{busy ? "Stop" : "Send"}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
