"use client";

import {
  CheckIcon,
  FileArchiveIcon,
  Loader2Icon,
  PaperclipIcon,
  SendIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import type { FileUIPart } from "ai";
import type { FormEvent } from "react";
import { useCallback, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { ZipPromptMessage } from "../support/types";

export type ZipPromptInputProps = {
  accept: string;
  busy: boolean;
  maxFileSize: number;
  onError: (message: string | null) => void;
  onStop: () => void;
  onSubmit: (message: ZipPromptMessage) => Promise<void>;
  onUploadFile: (file: File) => Promise<FileUIPart>;
};

type SelectedFile = {
  error?: string;
  file: File;
  id: string;
  status: "error" | "ready" | "uploading";
  uploaded?: FileUIPart;
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
  onUploadFile,
}: ZipPromptInputProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadFile = useCallback(
    async (file: File, id: string) => {
      try {
        const uploaded = await onUploadFile(file);
        setFiles((current) =>
          current.map((item) =>
            item.id === id ? { ...item, status: "ready", uploaded } : item,
          ),
        );
        onError(null);
      } catch (uploadError) {
        const message =
          uploadError instanceof Error
            ? uploadError.message
            : "Attachment upload failed.";
        setFiles((current) =>
          current.map((item) =>
            item.id === id ? { ...item, error: message, status: "error" } : item,
          ),
        );
        onError(message);
      }
    },
    [onError, onUploadFile],
  );

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
      const id = crypto.randomUUID();
      setFiles([{ file: zip, id, status: "uploading" }]);
      void uploadFile(zip, id);
    },
    [accept, maxFileSize, onError, uploadFile],
  );

  const removeFile = useCallback((item: SelectedFile) => {
    setFiles((current) => current.filter((file) => file.id !== item.id));
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedText = text.trim();
      if (!trimmedText && files.length === 0) {
        return;
      }
      const uploadedFiles = files.flatMap((item) =>
        item.uploaded ? [item.uploaded] : [],
      );
      if (uploadedFiles.length !== files.length) {
        return;
      }

      setSubmitting(true);
      try {
        await onSubmit({
          files: uploadedFiles,
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

  const uploading = files.some((item) => item.status === "uploading");
  const hasUploadError = files.some((item) => item.status === "error");
  const disabled = busy || submitting;
  const sendDisabled = submitting || uploading || hasUploadError;

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
                {item.status === "uploading" ? (
                  <Loader2Icon className="size-3 animate-spin text-[var(--chat-text-muted)]" />
                ) : item.status === "ready" ? (
                  <CheckIcon className="size-3 text-[var(--linear-success)]" />
                ) : (
                  <span className="text-[var(--linear-danger)]">failed</span>
                )}
                <button
                  aria-label="Remove attachment"
                  className="inline-flex size-4 items-center justify-center rounded-sm text-[var(--chat-text-muted)] transition-colors hover:bg-[var(--linear-ghost-hover)] hover:text-[var(--foreground)]"
                  onClick={() => removeFile(item)}
                  type="button"
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <textarea
          className="field-sizing-content max-h-44 min-h-16 w-full resize-none bg-transparent px-4 py-2.5 text-[15px] leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--chat-text-muted)] focus-visible:ring-0 focus-visible:ring-offset-0"
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
          placeholder={busy ? "Waiting for response..." : "Attach a zip and ask for grading..."}
          value={text}
        />

        <div className="flex items-center justify-between gap-1 px-3 pb-2">
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
                "border-[var(--linear-border)] bg-[var(--linear-ghost)] text-[var(--foreground)] shadow-none hover:bg-[var(--linear-ghost-hover)] hover:text-[var(--linear-danger)]",
            )}
            disabled={sendDisabled}
            onClick={busy ? onStop : undefined}
            type={busy ? "button" : "submit"}
          >
            {busy ? (
              <SquareIcon className="size-3.5" />
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
