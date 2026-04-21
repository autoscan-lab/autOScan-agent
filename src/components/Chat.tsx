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
import { useMemo, useState } from "react";

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

type ChatProps = {
  userEmail?: string | null;
  userName?: string | null;
};

function roleLabel(role: UIMessage["role"]) {
  return role === "user" ? "You" : role === "assistant" ? "autOScan" : role;
}

function MessageAvatar({ role }: { role: UIMessage["role"] }) {
  const Icon = role === "user" ? UserIcon : BotIcon;

  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full border",
        role === "user"
          ? "border-[var(--rui-dark)] bg-[var(--rui-dark)] text-white"
          : "border-[var(--rui-grey-tone-20)] bg-white text-[var(--rui-dark)]",
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
    <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--rui-grey-tone-20)] bg-[var(--rui-surface)] px-3 py-1.5 text-sm text-[var(--rui-dark)]">
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
      className="border-[var(--rui-grey-tone-20)] bg-white"
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

function AttachmentPreview() {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.files.map((file) => (
        <button
          className="inline-flex max-w-full items-center gap-2 rounded-full bg-[var(--rui-surface)] px-3 py-1.5 text-sm text-[var(--rui-dark)] transition-opacity hover:opacity-85"
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

const suggestions = [
  "Grade S0 from the attached zip",
  "List students",
  "Show latest summary",
  "Export grades",
];

function EmptyChatState({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <section className="mx-auto flex min-h-[54vh] w-full max-w-3xl flex-col items-center justify-center px-4 py-14 text-center">
      <h1 className="font-heading text-4xl tracking-[-0.04em] text-[var(--rui-dark)] md:text-6xl">
        What are we grading?
      </h1>
      <p className="mt-5 max-w-xl text-base leading-7 text-[var(--rui-muted)] md:text-lg">
        Attach a submissions zip and ask for grades, summaries, or exports.
      </p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        {suggestions.map((suggestion) => (
          <button
            className="rounded-full border border-[var(--rui-grey-tone-20)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--rui-dark)] transition-colors hover:bg-[var(--rui-surface)]"
            key={suggestion}
            onClick={() => onSelect(suggestion)}
            type="button"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  );
}

export function Chat({ userEmail, userName }: ChatProps) {
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const { error, messages, sendMessage, status, stop } = useChat({
    experimental_throttle: 80,
  });

  const isBusy = status === "submitted" || status === "streaming";
  const displayName = userName || userEmail || "User";
  const messageList = useMemo(() => messages ?? [], [messages]);

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f7f7] text-[var(--foreground)]">
      <header className="sticky top-0 z-20 border-b border-[var(--rui-grey-tone-20)] bg-white/85 px-4 py-3 backdrop-blur-xl md:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <p className="font-heading text-xl tracking-[-0.03em] text-[var(--rui-dark)]">
            autOScan
          </p>

          <div className="flex min-w-0 items-center gap-3">
            <p className="hidden min-w-0 truncate text-sm text-[var(--rui-muted)] sm:block">
              {displayName}
            </p>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[var(--rui-grey-tone-20)] bg-white px-4 py-2 text-sm font-medium text-[var(--rui-dark)] transition hover:border-[var(--rui-dark)]"
              onClick={() => void signOut({ redirectTo: "/sign-in" })}
              type="button"
            >
              Sign out
              <ArrowUpRightIcon className="size-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Conversation className="bg-[radial-gradient(circle_at_top,#ffffff_0%,#ffffff_28%,#f7f7f7_72%)]">
          <ConversationContent className="mx-auto w-full max-w-4xl gap-7 px-4 py-8 md:px-6">
            {messageList.length === 0 ? (
              <EmptyChatState onSelect={(text) => sendMessage({ text })} />
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
                    className="max-w-[min(44rem,92%)]"
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
                    <MessageContent className="rounded-[20px] border border-[var(--rui-grey-tone-20)] bg-white px-4 py-3 text-[15px] leading-7 group-[.is-user]:rounded-[20px] group-[.is-user]:bg-[var(--rui-dark)] group-[.is-user]:text-white md:px-5 md:py-4">
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
                Working...
              </div>
            ) : null}

            {error ? (
              <div className="rounded-[20px] border border-[var(--rui-danger)]/20 bg-[var(--rui-danger)]/10 p-4 text-sm text-[var(--rui-danger)]">
                {error.message}
              </div>
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t border-[var(--rui-grey-tone-20)] bg-white px-4 py-4 md:px-8">
          <div className="mx-auto max-w-4xl">
            {attachmentError ? (
              <p className="mb-2 text-sm text-[var(--rui-danger)]">
                {attachmentError}
              </p>
            ) : null}
            <PromptInput
              accept=".zip,application/zip,application/x-zip-compressed"
              className="rounded-[28px] border border-[var(--rui-grey-tone-20)] bg-white p-2"
              maxFileSize={4 * 1024 * 1024}
              multiple={false}
              onError={(err) =>
                setAttachmentError(
                  `${err.message} Please attach a .zip file under 4 MB.`,
                )
              }
              onSubmit={({ files, text }) => {
                setAttachmentError(null);
                if (!text.trim() && files.length === 0) {
                  return;
                }

                sendMessage({ files, text });
              }}
            >
              <PromptInputHeader>
                <AttachmentPreview />
              </PromptInputHeader>
              <PromptInputBody>
                <PromptInputTextarea placeholder="Ask autOScan to grade, review, adjust, or export..." />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptTools />
                <div className="flex items-center gap-2">
                  <PromptInputSubmit
                    className="rounded-full"
                    onStop={stop}
                    status={status}
                  />
                </div>
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </main>
    </div>
  );
}
