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
  const [visible, setVisible] = useState(false);
  const portalRoot = typeof document === "undefined" ? null : document.body;

  useEffect(() => {
    // Let the closed state paint once before the curtain drops in.
    let inner: number | undefined;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      window.cancelAnimationFrame(outer);
      if (inner !== undefined) window.cancelAnimationFrame(inner);
    };
  }, []);

  function close() {
    onCloseStart?.();
    setVisible(false);
    window.setTimeout(onClose, 500);
  }

  if (!portalRoot) return null;

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
    portalRoot,
  );
}
