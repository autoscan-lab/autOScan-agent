"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export function DetailDrawer({
  children,
  onClose,
  onCloseStart,
}: {
  children: (close: () => void) => ReactNode;
  onClose: () => void;
  onCloseStart?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Double rAF: ensures the initial -translate-y-full state is painted
    // before the transition fires, so the curtain drop is visible.
    const outer = window.requestAnimationFrame(() => {
      const inner = window.requestAnimationFrame(() => setVisible(true));
      return inner;
    });
    return () => window.cancelAnimationFrame(outer);
  }, []);

  function close() {
    onCloseStart?.();
    setVisible(false);
    window.setTimeout(onClose, 500);
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex min-h-0 origin-top flex-col overflow-hidden bg-[var(--chat-bg)]",
        "transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        visible ? "translate-y-0" : "-translate-y-full",
      )}
    >
      {children(close)}
    </div>,
    document.body,
  );
}
