import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PlusIcon, SaveIcon, XIcon } from "lucide-react";
import type { SaveState } from "../support/types";

export function labelClass() {
  return "text-[11px] font-[510] uppercase tracking-wider text-[var(--chat-text-muted)]";
}

export function fieldClass(className?: string) {
  return cn(
    "border-white/[0.06] bg-white/[0.02] text-[13px] text-[var(--foreground)] placeholder:text-[var(--linear-text-subtle)] focus-visible:border-white/[0.12] focus-visible:ring-[var(--linear-accent)]/25",
    className,
  );
}

export function SectionShell({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <div>
      <div className="mb-3">
        <h2 className="text-[13px] font-[510] text-[var(--foreground)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-[12px] text-[var(--chat-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="rounded-xl border border-white/[0.04] bg-[var(--linear-surface)] px-6 py-5">
        {children}
      </div>
    </div>
  );
}

export function TextField({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className={labelClass()}>{label}</span>
      <Input
        className={fieldClass()}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

export function TextAreaField({
  className,
  label,
  onChange,
  placeholder,
  rows = 4,
  value,
}: {
  className?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  value: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className={labelClass()}>{label}</span>
      <Textarea
        className={fieldClass(cn("resize-y leading-relaxed", className))}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        value={value}
      />
    </label>
  );
}

export function StringListEditor({
  addLabel,
  itemPlaceholder,
  label,
  onChange,
  values,
}: {
  addLabel: string;
  itemPlaceholder: string;
  label: string;
  onChange: (values: string[]) => void;
  values: string[];
}) {
  return (
    <div className="space-y-2">
      <div className={labelClass()}>{label}</div>
      <div className="space-y-1.5">
        {values.map((value, index) => (
          <div className="flex items-center gap-2" key={index}>
            <Input
              className={fieldClass()}
              onChange={(event) => {
                const next = [...values];
                next[index] = event.target.value;
                onChange(next);
              }}
              placeholder={itemPlaceholder}
              value={value}
            />
            <button
              aria-label="Remove"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-white/[0.05] bg-white/[0.02] text-[var(--chat-text-muted)] transition-colors hover:border-white/[0.08] hover:bg-white/[0.05] hover:text-[var(--linear-danger)]"
              onClick={() =>
                onChange(values.filter((_, itemIndex) => itemIndex !== index))
              }
              type="button"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/[0.05] bg-white/[0.02] px-2.5 text-[12px] font-[510] text-[var(--chat-text-secondary)] transition-colors hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-[var(--foreground)]"
        onClick={() => onChange([...values, ""])}
        type="button"
      >
        <PlusIcon className="size-3" />
        {addLabel}
      </button>
    </div>
  );
}

export function SaveButton({
  children,
  onClick,
  state,
}: {
  children: React.ReactNode;
  onClick: () => void;
  state: SaveState;
}) {
  return (
    <Button
      className="h-8 gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-[12px] font-[510] text-[var(--foreground)] hover:bg-white/[0.07]"
      disabled={state === "saving"}
      onClick={onClick}
      size="sm"
      type="button"
      variant="ghost"
    >
      <SaveIcon className="size-3.5" />
      {state === "saving" ? "Saving..." : children}
    </Button>
  );
}
