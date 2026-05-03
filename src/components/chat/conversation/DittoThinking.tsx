"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Verb = {
  active: string;
  past: string;
};

const cyclingVerbs: Verb[] = [
  { active: "Compiling", past: "Compiled" },
  { active: "Testing", past: "Tested" },
  { active: "Scanning", past: "Scanned" },
  { active: "Reading", past: "Read" },
  { active: "Checking", past: "Checked" },
  { active: "Spotting", past: "Spotted" },
  { active: "Crunching", past: "Crunched" },
  { active: "Pondering", past: "Pondered" },
  { active: "Cooking", past: "Cooked" },
  { active: "Reviewing", past: "Reviewed" },
];

const verbIntervalMs = 1800;
const frameCount = 8;
const frameDurationMs = 100;
const loopDurationMs = frameCount * frameDurationMs;

function randomVerbIndex(exceptIndex?: number) {
  if (cyclingVerbs.length <= 1) {
    return 0;
  }

  let next = Math.floor(Math.random() * cyclingVerbs.length);
  if (next === exceptIndex) {
    next =
      (next + 1 + Math.floor(Math.random() * (cyclingVerbs.length - 1))) %
      cyclingVerbs.length;
  }
  return next;
}

function formatElapsed(ms: number) {
  const roundedMs = Math.max(0, Math.round(ms));
  if (roundedMs < 1000) {
    return `${roundedMs}ms`;
  }

  const totalSeconds = Math.round(roundedMs / 1000);
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
        "ditto-sprite shrink-0",
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
  initialElapsedMs = 0,
  onElapsedSettled,
}: {
  active: boolean;
  initialElapsedMs?: number;
  onElapsedSettled?: (elapsedMs: number) => void;
}) {
  const [elapsedMs, setElapsedMs] = useState(initialElapsedMs);
  const [verbIndex, setVerbIndex] = useState(() => randomVerbIndex());
  const [lastVerbIndex, setLastVerbIndex] = useState(() => randomVerbIndex());
  const [pausedState, setPausedState] = useState<"paused" | "playing-once">(
    "paused",
  );
  const elapsedMsRef = useRef(initialElapsedMs);
  const playOnceTimer = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const wasActive = useRef(active);
  const reportedElapsed = useRef(!active);

  useEffect(() => {
    if (active && !wasActive.current) {
      const randomIndex = randomVerbIndex(lastVerbIndex);
      setVerbIndex(randomIndex);
      setLastVerbIndex(randomIndex);
      elapsedMsRef.current = 0;
      startedAt.current = Date.now();
      setElapsedMs(0);
      reportedElapsed.current = false;
    }
    if (!active && wasActive.current && !reportedElapsed.current) {
      onElapsedSettled?.(elapsedMsRef.current);
      reportedElapsed.current = true;
    }
    wasActive.current = active;
  }, [active, lastVerbIndex, onElapsedSettled]);

  useEffect(() => {
    if (!active) {
      return;
    }

    if (startedAt.current === null) {
      startedAt.current = Date.now() - elapsedMsRef.current;
    }

    const id = window.setInterval(() => {
      const nextElapsedMs = Date.now() - (startedAt.current ?? Date.now());
      elapsedMsRef.current = nextElapsedMs;
      setElapsedMs(nextElapsedMs);
    }, 250);

    return () => window.clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const id = window.setInterval(() => {
      setVerbIndex((value) => {
        const next = randomVerbIndex(value);
        setLastVerbIndex(next);
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
      <span className="flex items-center gap-2 overflow-visible leading-none">
        <DittoSprite state="looping" />
        <span className="relative -my-1 inline-flex h-[1.6em] overflow-hidden px-0.5 py-1 leading-[1.35]">
          {cyclingVerbs.map((verb, index) => (
            <span
              aria-hidden={index !== verbIndex}
              className={cn(
                "absolute left-0 top-0 whitespace-nowrap font-[700] transition-all duration-300",
                index === verbIndex
                  ? "translate-y-0 opacity-100"
                  : "translate-y-2 opacity-0",
              )}
              key={verb.active}
            >
              {verb.active}...
            </span>
          ))}
          <span className="invisible whitespace-nowrap font-[700]">
            {cyclingVerbs.reduce(
              (longest, verb) =>
                verb.active.length > longest.length ? verb.active : longest,
              "",
            )}...
          </span>
        </span>
      </span>
    );
  }

  const lastVerb = cyclingVerbs[lastVerbIndex] ?? cyclingVerbs[0];
  const label = `${lastVerb.past} for ${formatElapsed(elapsedMs)}`;

  return (
    <span className="flex items-center gap-2 overflow-visible">
      <DittoSprite onClick={poke} state={pausedState} />
      <span className="font-[700]">{label}</span>
    </span>
  );
}
