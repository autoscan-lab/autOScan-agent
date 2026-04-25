"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Verb = {
  active: string;
  past: string;
};

const cyclingVerbs: Verb[] = [
  { active: "Compiling", past: "Compiled" },
  { active: "Running tests", past: "Ran tests" },
  { active: "Scanning code", past: "Scanned code" },
  { active: "Reading source", past: "Read source" },
  { active: "Looking at submissions", past: "Looked at submissions" },
  { active: "Checking output", past: "Checked output" },
  { active: "Spotting issues", past: "Spotted issues" },
  { active: "Crunching numbers", past: "Crunched numbers" },
  { active: "Pondering", past: "Pondered" },
  { active: "Cooking", past: "Cooked" },
];

const verbIntervalMs = 1800;
const frameCount = 5;
const frameDurationMs = 100;
const loopDurationMs = frameCount * frameDurationMs;

function formatElapsed(ms: number) {
  if (ms < 1000) {
    return "<1s";
  }
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

type DittoState = "looping" | "paused" | "playing-once";

function DittoSprite({
  onClick,
  state,
}: {
  onClick?: () => void;
  state: DittoState;
}) {
  const isInteractive = state === "paused" && Boolean(onClick);
  return (
    <span
      aria-hidden
      className={cn(
        "ditto-sprite size-5 shrink-0",
        state === "looping" && "ditto-sprite--looping",
        state === "playing-once" && "ditto-sprite--playing-once",
        state === "paused" && "ditto-sprite--paused",
        isInteractive && "cursor-pointer",
      )}
      onClick={isInteractive ? onClick : undefined}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    />
  );
}

export function DittoThinking({
  active,
  stepCount,
}: {
  active: boolean;
  stepCount: number;
}) {
  const startedAtRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [verbIndex, setVerbIndex] = useState(0);
  const lastVerbRef = useRef(0);
  const [pausedState, setPausedState] = useState<"paused" | "playing-once">(
    "paused",
  );
  const playOnceTimer = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      if (startedAtRef.current === null) {
        startedAtRef.current = Date.now();
      }
      setElapsed(null);
      return;
    }
    if (startedAtRef.current !== null && elapsed === null) {
      setElapsed(Date.now() - startedAtRef.current);
    }
  }, [active, elapsed]);

  useEffect(() => {
    if (!active) {
      return;
    }
    setVerbIndex(0);
    lastVerbRef.current = 0;
    const id = window.setInterval(() => {
      setVerbIndex((value) => {
        const next = (value + 1) % cyclingVerbs.length;
        lastVerbRef.current = next;
        return next;
      });
    }, verbIntervalMs);
    return () => window.clearInterval(id);
  }, [active]);

  useEffect(() => {
    return () => {
      if (playOnceTimer.current !== null) {
        window.clearTimeout(playOnceTimer.current);
      }
    };
  }, []);

  function poke() {
    if (pausedState === "playing-once") {
      return;
    }
    setPausedState("playing-once");
    if (playOnceTimer.current !== null) {
      window.clearTimeout(playOnceTimer.current);
    }
    playOnceTimer.current = window.setTimeout(() => {
      setPausedState("paused");
      playOnceTimer.current = null;
    }, loopDurationMs);
  }

  if (active) {
    return (
      <span className="flex items-center gap-2">
        <DittoSprite state="looping" />
        <span className="relative inline-flex h-[1.2em] overflow-hidden">
          {cyclingVerbs.map((verb, index) => (
            <span
              aria-hidden={index !== verbIndex}
              className={cn(
                "absolute left-0 top-0 whitespace-nowrap font-[510] transition-all duration-300",
                index === verbIndex
                  ? "translate-y-0 opacity-100"
                  : "translate-y-2 opacity-0",
              )}
              key={verb.active}
            >
              {verb.active}
            </span>
          ))}
          <span className="invisible whitespace-nowrap font-[510]">
            {cyclingVerbs.reduce(
              (longest, verb) =>
                verb.active.length > longest.length ? verb.active : longest,
              "",
            )}
          </span>
        </span>
        <span className="font-mono text-[var(--chat-text-muted)]">...</span>
      </span>
    );
  }

  const lastVerb = cyclingVerbs[lastVerbRef.current] ?? cyclingVerbs[0];
  const label =
    elapsed !== null
      ? `${lastVerb.past} for ${formatElapsed(elapsed)}`
      : `Thought through ${stepCount} step${stepCount === 1 ? "" : "s"}`;

  return (
    <span className="flex items-center gap-2">
      <DittoSprite onClick={poke} state={pausedState} />
      <span className="font-[510]">{label}</span>
    </span>
  );
}
