"use client";

import { FileCogIcon, LogOutIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

import { initialsOf } from "@/components/chat/shared/display";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AccountMenuProps = {
  isModelBusy: boolean;
  messageCount: number;
  onClearHistory: () => Promise<void>;
  onError: (message: string) => void;
  userEmail?: string | null;
  userImage?: string | null;
  userName?: string | null;
};

export function AccountMenu({
  isModelBusy,
  messageCount,
  onClearHistory,
  onError,
  userEmail,
  userImage,
  userName,
}: AccountMenuProps) {
  const router = useRouter();
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const displayName = userName || userEmail || "User";

  async function handleClearHistory() {
    setIsClearingHistory(true);
    try {
      await onClearHistory();
    } catch (clearError) {
      onError(
        clearError instanceof Error
          ? clearError.message
          : "Could not clear chat history.",
      );
    } finally {
      setIsClearingHistory(false);
    }
  }

  return (
    <div className="fixed bottom-5 left-5 z-40">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="inline-flex size-8 items-center justify-center overflow-hidden rounded-full border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] font-mono text-[10px] font-[510] text-[var(--chat-text-secondary)] shadow-[var(--shadow-dialog)] backdrop-blur-md transition-colors hover:border-[var(--linear-border)] hover:bg-[var(--linear-ghost-hover)] hover:text-[var(--foreground)]"
        >
          {userImage ? (
            <Image
              alt=""
              className="size-full object-cover"
              height={32}
              priority
              referrerPolicy="no-referrer"
              src={userImage}
              width={32}
            />
          ) : (
            initialsOf(displayName)
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="min-w-48"
          side="top"
          sideOffset={8}
        >
          <div className="px-2 pb-1.5 pt-2">
            <span className="block truncate text-[13px] font-[510] text-[var(--foreground)]">
              {userName || "Signed in"}
            </span>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/policies")}>
            <FileCogIcon />
            Policy builder
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isModelBusy || isClearingHistory || messageCount === 0}
            onClick={() => void handleClearHistory()}
          >
            <Trash2Icon />
            {isClearingHistory ? "Clearing..." : "Clear chat"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void signOut({ redirectTo: "/sign-in" })}
            variant="destructive"
          >
            <LogOutIcon />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
