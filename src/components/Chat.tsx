"use client";

import { useChat } from "@ai-sdk/react";
import {
  getStaticToolName,
  isReasoningUIPart,
  isToolUIPart,
  type FileUIPart,
  type UIMessage,
} from "ai";
import {
  ArrowUpRightIcon,
  BotIcon,
  FileArchiveIcon,
  Loader2Icon,
  PaperclipIcon,
  UserIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { cn } from "@/lib/utils";

const chatWatchdogMs = 180_000;
const maxZipUploadBytes = 12 * 1024 * 1024;

type ChatProps = {
  initialChatId?: string;
  initialMessages?: UIMessage[];
  userEmail?: string | null;
  userName?: string | null;
};

type UploadResponse = {
  filename?: string;
  mediaType?: string;
  url: string;
};

function roleLabel(role: UIMessage["role"]) {
  return role === "user" ? "You" : role === "assistant" ? "autOScan" : role;
}

function messageDigest(messages: UIMessage[]) {
  return messages
    .map((message) => {
      const partDigest = message.parts
        .map((part) => {
          if (part.type === "text") {
            return `text:${part.text.length}`;
          }

          if (part.type === "file") {
            return `file:${part.filename ?? "unknown"}`;
          }

          if ("state" in part && typeof part.state === "string") {
            return `${part.type}:${part.state}`;
          }

          return part.type;
        })
        .join(",");

      return `${message.id}:${message.role}:${partDigest}`;
    })
    .join("|");
}

function MessageAvatar({ role }: { role: UIMessage["role"] }) {
  const Icon = role === "user" ? UserIcon : BotIcon;

  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full border",
        role === "user"
          ? "border-[var(--chat-user-bubble)] bg-[var(--chat-user-bubble)] text-[var(--chat-user-text)]"
          : "border-[var(--chat-border)] bg-[var(--chat-card)] text-[var(--foreground)]",
      )}
    >
      <Icon className="size-4" />
    </div>
  );
}

function textFromPart(part: UIMessage["parts"][number]) {
  return part.type === "text" ? part.text : "";
}

function FilePart({ part }: { part: FileUIPart }) {
  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--chat-border)] bg-[var(--chat-soft)] px-3 py-1.5 text-sm text-[var(--foreground)]">
      <FileArchiveIcon className="size-4 shrink-0" />
      <span className="truncate">{part.filename ?? part.mediaType}</span>
    </div>
  );
}

function ToolPart({ part }: { part: UIMessage["parts"][number] }) {
  if (!isToolUIPart(part)) {
    return null;
  }

  const title =
    part.type === "dynamic-tool"
      ? part.toolName
      : String(getStaticToolName(part));

  return (
    <Tool
      className="border-[var(--chat-border)] bg-[var(--chat-soft)]"
      defaultOpen={part.state !== "output-available"}
    >
      {part.type === "dynamic-tool" ? (
        <ToolHeader
          state={part.state}
          title={title}
          toolName={part.toolName}
          type={part.type}
        />
      ) : (
        <ToolHeader state={part.state} title={title} type={part.type} />
      )}
      <ToolContent>
        {"input" in part && part.input !== undefined ? (
          <ToolInput input={part.input} />
        ) : null}
        <ToolOutput
          errorText={"errorText" in part ? part.errorText : undefined}
          output={"output" in part ? part.output : undefined}
        />
      </ToolContent>
    </Tool>
  );
}

function MessageParts({ message }: { message: UIMessage }) {
  const text = message.parts.map(textFromPart).join("");
  const nonTextParts = message.parts.filter((part) => part.type !== "text");
  const reasoningParts = nonTextParts.filter(isReasoningUIPart);
  const toolParts = nonTextParts.filter(isToolUIPart);
  const fileParts = nonTextParts.filter(
    (part): part is FileUIPart => part.type === "file",
  );

  return (
    <>
      {fileParts.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {fileParts.map((part, index) => (
            <FilePart key={`${part.url}-${index}`} part={part} />
          ))}
        </div>
      ) : null}

      {reasoningParts.length > 0 || toolParts.length > 0 ? (
        <ChainOfThought
          className="mb-3"
          defaultOpen={toolParts.some(
            (part) => part.state !== "output-available",
          )}
        >
          <ChainOfThoughtHeader>Actions</ChainOfThoughtHeader>
          <ChainOfThoughtContent>
            {reasoningParts.map((part, index) => (
              <ChainOfThoughtStep
                key={`reasoning-${index}`}
                label="Reasoning"
                status={part.state === "done" ? "complete" : "active"}
              >
                <MessageResponse>{part.text}</MessageResponse>
              </ChainOfThoughtStep>
            ))}
            {toolParts.map((part, index) => (
              <ChainOfThoughtStep
                key={`${part.type}-${index}`}
                label={
                  part.type === "dynamic-tool"
                    ? part.toolName
                    : String(getStaticToolName(part))
                }
                status={
                  part.state === "output-available" ? "complete" : "active"
                }
              >
                <ToolPart part={part} />
              </ChainOfThoughtStep>
            ))}
          </ChainOfThoughtContent>
        </ChainOfThought>
      ) : null}

      {text ? <MessageResponse>{text}</MessageResponse> : null}
    </>
  );
}

function EmptyChatState() {
  return (
    <section className="mx-auto flex min-h-[52vh] w-full max-w-3xl flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="font-heading text-4xl tracking-[-0.04em] text-[var(--foreground)] md:text-6xl">
        Ready to grade?
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--rui-muted)] md:text-lg">
        Attach one submissions zip and ask something like{" "}
        <span className="font-medium text-[var(--foreground)]">“Grade S0”</span>
        . You can then review, adjust, and export grades in the same chat.
      </p>
    </section>
  );
}

function AttachmentPreview() {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.files.map((file) => (
        <button
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--chat-border)] bg-[var(--chat-soft)] px-3 py-1.5 text-sm text-[var(--foreground)] transition-opacity hover:opacity-85"
          key={file.id}
          onClick={() => attachments.remove(file.id)}
          type="button"
        >
          <FileArchiveIcon className="size-4 shrink-0" />
          <span className="truncate">{file.filename ?? file.mediaType}</span>
          <span className="text-[var(--rui-muted)]">remove</span>
        </button>
      ))}
    </div>
  );
}

function PromptTools() {
  const attachments = usePromptInputAttachments();

  return (
    <PromptInputTools className="flex min-w-0 items-center gap-2">
      <PromptInputButton
        className="rounded-full"
        onClick={() => attachments.openFileDialog()}
        tooltip="Attach a submissions zip"
        type="button"
      >
        <PaperclipIcon className="size-4" />
      </PromptInputButton>
    </PromptInputTools>
  );
}

export function Chat({
  initialChatId,
  initialMessages,
  userEmail,
  userName,
}: ChatProps) {
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const lastPersistedDigest = useRef(messageDigest(initialMessages ?? []));

  const { error, id, messages, sendMessage, setMessages, status, stop } = useChat({
    id: initialChatId,
    messages: initialMessages,
    experimental_throttle: 80,
  });

  const isModelBusy = status === "submitted" || status === "streaming";
  const isBusy = isModelBusy || isUploadingAttachment;
  const displayName = userName || userEmail || "User";
  const messageList = useMemo(() => messages ?? [], [messages]);

  const persistChatState = useCallback(
    async (nextMessages: UIMessage[]) => {
      const digest = messageDigest(nextMessages);
      if (!digest || digest === lastPersistedDigest.current) {
        return;
      }

      const response = await fetch("/api/chat/state", {
        body: JSON.stringify({
          chatId: id,
          messages: nextMessages,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error("Could not persist chat state.");
      }

      lastPersistedDigest.current = digest;
    },
    [id],
  );

  const uploadAttachment = useCallback(async (part: FileUIPart) => {
    if (part.url.startsWith("r2://")) {
      return part;
    }

    const source = await fetch(part.url);
    if (!source.ok) {
      throw new Error("Could not read the attached zip file.");
    }

    const blob = await source.blob();
    const filename = part.filename ?? "submissions.zip";
    const mediaType = part.mediaType || blob.type || "application/zip";
    const formData = new FormData();
    formData.set("file", blob, filename);

    const response = await fetch("/api/chat/uploads", {
      body: formData,
      method: "POST",
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(detail || "Attachment upload failed.");
    }

    const payload = (await response.json()) as UploadResponse;
    return {
      ...part,
      filename: payload.filename ?? filename,
      mediaType: payload.mediaType ?? mediaType,
      url: payload.url,
    };
  }, []);

  const clearHistory = useCallback(async () => {
    const response = await fetch("/api/chat/state", {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Could not clear chat history.");
    }

    setMessages([]);
    setAttachmentError(null);
    setRuntimeError(null);
    lastPersistedDigest.current = messageDigest([]);
  }, [setMessages]);

  useEffect(() => {
    if (status !== "ready" && status !== "error") {
      return;
    }
    if (messageList.length === 0) {
      return;
    }

    void persistChatState(messageList).catch(() => {
      // Non-blocking: the chat should continue even if persistence fails.
    });
  }, [messageList, persistChatState, status]);

  useEffect(() => {
    if (!isModelBusy) {
      return;
    }

    const timeout = window.setTimeout(() => {
      stop();
      setRuntimeError(
        "The assistant took too long and was stopped. Please retry your request.",
      );
    }, chatWatchdogMs);

    return () => window.clearTimeout(timeout);
  }, [isModelBusy, stop]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--chat-bg)] text-[var(--foreground)]">
      <header className="sticky top-0 z-20 border-b border-[var(--chat-border)] bg-[var(--chat-header-bg)]/90 px-4 py-3 backdrop-blur-xl md:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <p className="font-heading text-xl tracking-[-0.03em] text-[var(--foreground)]">
            autOScan
          </p>

          <div className="flex min-w-0 items-center gap-3">
            <p className="hidden min-w-0 truncate text-sm text-[var(--rui-muted)] sm:block">
              {displayName}
            </p>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[var(--chat-border)] bg-[var(--chat-soft)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={isBusy || isClearingHistory || messageList.length === 0}
              onClick={async () => {
                if (
                  !window.confirm(
                    "Clear this chat history? This will remove your messages from this session.",
                  )
                ) {
                  return;
                }

                setIsClearingHistory(true);
                try {
                  await clearHistory();
                } catch (clearError) {
                  setRuntimeError(
                    clearError instanceof Error
                      ? clearError.message
                      : "Could not clear chat history.",
                  );
                } finally {
                  setIsClearingHistory(false);
                }
              }}
              type="button"
            >
              {isClearingHistory ? "Clearing..." : "Clear history"}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[var(--chat-border)] bg-[var(--chat-soft)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]"
              onClick={() => void signOut({ redirectTo: "/sign-in" })}
              type="button"
            >
              Sign out
              <ArrowUpRightIcon className="size-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <Conversation className="min-h-0 bg-[radial-gradient(circle_at_top,var(--chat-radial-top)_0%,var(--chat-radial-mid)_38%,var(--chat-bg)_78%)]">
          <ConversationContent className="mx-auto w-full max-w-4xl gap-7 px-4 pb-44 pt-8 md:px-6 md:pb-52 md:pt-10">
            {messageList.length === 0 ? (
              <EmptyChatState />
            ) : (
              messageList.map((message) => (
                <div
                  className={cn(
                    "flex gap-3",
                    message.role === "user" && "justify-end",
                  )}
                  key={message.id}
                >
                  {message.role !== "user" ? (
                    <MessageAvatar role={message.role} />
                  ) : null}
                  <Message
                    className="max-w-[min(48rem,96%)]"
                    from={message.role}
                  >
                    <div
                      className={cn(
                        "mb-1 text-xs font-medium uppercase tracking-[0.16em] text-[var(--rui-muted)]",
                        message.role === "user" && "text-right",
                      )}
                    >
                      {roleLabel(message.role)}
                    </div>
                    <MessageContent className="rounded-[22px] border border-[var(--chat-border)] bg-[var(--chat-card)] px-4 py-3 text-[15px] leading-7 text-[var(--foreground)] group-[.is-user]:border-[var(--chat-user-bubble)] group-[.is-user]:bg-[var(--chat-user-bubble)] group-[.is-user]:text-[var(--chat-user-text)] group-[.is-user]:shadow-none md:px-5 md:py-4">
                      <MessageParts message={message} />
                    </MessageContent>
                  </Message>
                  {message.role === "user" ? (
                    <MessageAvatar role={message.role} />
                  ) : null}
                </div>
              ))
            )}

            {isBusy ? (
              <div className="flex items-center gap-2 text-sm text-[var(--rui-muted)]">
                <Loader2Icon className="size-4 animate-spin" />
                {isUploadingAttachment
                  ? "Uploading zip..."
                  : "autOScan is working..."}
              </div>
            ) : null}

            {runtimeError ? (
              <div className="rounded-[20px] border border-[var(--rui-warning)]/30 bg-[var(--rui-warning)]/10 p-4 text-sm text-[var(--rui-warning)]">
                {runtimeError}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-[20px] border border-[var(--rui-danger)]/30 bg-[var(--rui-danger)]/10 p-4 text-sm text-[var(--rui-danger)]">
                {error.message}
              </div>
            ) : null}
          </ConversationContent>
          <ConversationScrollButton className="bottom-28 z-20 md:bottom-32" />
        </Conversation>

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
          <div className="mx-auto w-full max-w-4xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:pb-6">
            <div className="h-14 w-full bg-gradient-to-t from-[var(--chat-overlay)] to-transparent" />

            <div className="-mt-3 pointer-events-auto">
              {attachmentError ? (
                <p className="mb-2 px-2 text-sm text-[var(--rui-danger)]">
                  {attachmentError}
                </p>
              ) : null}
              <PromptInput
                accept=".zip,application/zip,application/x-zip-compressed"
                className="rounded-[28px] border border-[var(--chat-border)] bg-[color:var(--chat-composer)] p-2 backdrop-blur-xl"
                maxFileSize={maxZipUploadBytes}
                multiple={false}
                onError={(err) =>
                  setAttachmentError(
                    `${err.message} Please attach a .zip under ${
                      maxZipUploadBytes / (1024 * 1024)
                    } MB.`,
                  )
                }
                onSubmit={async ({ files, text }) => {
                  const trimmedText = text.trim();
                  setAttachmentError(null);
                  setRuntimeError(null);

                  if (!trimmedText && files.length === 0) {
                    return;
                  }

                  try {
                    let preparedFiles: FileUIPart[] = [];
                    if (files.length > 0) {
                      setIsUploadingAttachment(true);
                      try {
                        preparedFiles = await Promise.all(
                          files.map(uploadAttachment),
                        );
                      } finally {
                        setIsUploadingAttachment(false);
                      }
                    }

                    if (preparedFiles.length > 0 && trimmedText) {
                      await sendMessage({ files: preparedFiles, text: trimmedText });
                      return;
                    }

                    if (preparedFiles.length > 0) {
                      await sendMessage({ files: preparedFiles });
                      return;
                    }

                    await sendMessage({ text: trimmedText });
                  } catch (submitError) {
                    setIsUploadingAttachment(false);
                    setAttachmentError(
                      submitError instanceof Error
                        ? submitError.message
                        : "Could not send your request.",
                    );
                  }
                }}
              >
                <PromptInputHeader>
                  <AttachmentPreview />
                </PromptInputHeader>
                <PromptInputBody>
                  <PromptInputTextarea placeholder="Attach a submissions zip and ask for grading..." />
                </PromptInputBody>
                <PromptInputFooter>
                  <PromptTools />
                  <PromptInputSubmit
                    className="rounded-full"
                    onStop={stop}
                    status={status}
                  />
                </PromptInputFooter>
              </PromptInput>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
