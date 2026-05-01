"use client";

import { UploadIcon } from "lucide-react";
import { useRef, useState } from "react";

import type { PolicyAssignment } from "@/lib/policies/types";
import { fieldClass, labelClass } from "../shared/form-controls";

export function PolicyFileEditor({
  assignment,
  label,
  onChange,
  values,
}: {
  assignment: PolicyAssignment;
  label: string;
  onChange: (values: string[]) => void;
  values: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);

      const res = await fetch(`/api/policies/${assignment}/files`, {
        body: formData,
        method: "POST",
      });

      if (!res.ok) {
        throw new Error((await res.text()) || "Upload failed.");
      }

      const { filename } = (await res.json()) as { filename: string };
      if (!values.includes(filename)) {
        onChange([...values, filename]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeFile(filename: string) {
    onChange(values.filter((f) => f !== filename));
    await fetch(`/api/policies/${assignment}/files`, {
      body: JSON.stringify({ filename }),
      headers: { "Content-Type": "application/json" },
      method: "DELETE",
    }).catch(() => {});
  }

  return (
    <div className="space-y-2">
      <div className={labelClass()}>{label}</div>

      {values.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {values.map((filename) => (
            <div className="relative" key={filename}>
              <div
                className={fieldClass(
                  "flex h-8 w-full items-center rounded-lg px-2.5 pr-7",
                )}
              >
                <span className="truncate text-[13px]">{filename}</span>
              </div>
              <button
                aria-label="Remove"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex size-5 items-center justify-center rounded text-[var(--chat-text-muted)] transition-colors hover:text-[var(--linear-danger)]"
                onClick={() => void removeFile(filename)}
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <p className="text-[12px] text-[var(--linear-danger)]">{error}</p>
      ) : null}

      <button
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/[0.05] bg-white/[0.02] px-2.5 text-[12px] font-[510] text-[var(--chat-text-secondary)] transition-colors hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-[var(--foreground)] disabled:opacity-50"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        <UploadIcon className="size-3" />
        {uploading ? "Uploading..." : "Upload file"}
      </button>

      <input
        className="hidden"
        onChange={handleFileChange}
        ref={inputRef}
        type="file"
      />
    </div>
  );
}
