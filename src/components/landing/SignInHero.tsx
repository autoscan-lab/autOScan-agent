"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import FaultyTerminal from "@/components/landing/FaultyTerminal";

type SignInHeroProps = {
  mode?: "sign-in" | "denied";
};

export function SignInHero({ mode = "sign-in" }: SignInHeroProps) {
  const router = useRouter();
  const isDenied = mode === "denied";

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-0 opacity-80">
        <FaultyTerminal
          brightness={0.72}
          chromaticAberration={0}
          curvature={0.08}
          digitSize={1.35}
          dither={0}
          flickerAmount={0.55}
          glitchAmount={0.8}
          gridMul={[2, 1]}
          mouseReact
          mouseStrength={0.24}
          noiseAmp={0.8}
          pageLoadAnimation
          scanlineIntensity={0.45}
          scale={1.45}
          timeScale={0.28}
          tint="#ffffff"
        />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.12),transparent_32%),linear-gradient(90deg,rgba(5,5,5,0.96)_0%,rgba(5,5,5,0.78)_46%,rgba(5,5,5,0.58)_100%)]" />

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-6 py-6 md:px-10">
        <div className="flex items-center justify-between gap-4">
          <span className="font-heading text-2xl font-semibold tracking-[-0.025em] text-white">
            autOScan
          </span>
          <a
            aria-label="Open autOScan Agent GitHub repository"
            className="inline-flex size-9 items-center justify-center text-white/78 transition hover:text-white"
            href="https://github.com/autoscan-lab/autoscan-agent"
            rel="noreferrer"
            target="_blank"
          >
            <svg aria-hidden="true" className="size-6" viewBox="0 0 24 24">
              <path
                d="M12 .3a12 12 0 0 0-3.79 23.39c.6.1.82-.26.82-.58v-2.25c-3.34.73-4.04-1.42-4.04-1.42-.55-1.37-1.33-1.74-1.33-1.74-1.09-.74.08-.72.08-.72 1.2.08 1.83 1.2 1.83 1.2 1.07 1.79 2.8 1.27 3.49.97.1-.75.42-1.27.76-1.56-2.66-.3-5.47-1.3-5.47-5.8 0-1.28.47-2.33 1.23-3.16-.13-.3-.53-1.5.12-3.12 0 0 1-.31 3.3 1.2a11.8 11.8 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.66 1.63.26 2.83.13 3.12.77.83 1.23 1.88 1.23 3.16 0 4.5-2.8 5.5-5.48 5.8.43.37.82 1.1.82 2.23v3.3c0 .32.22.69.83.57A12 12 0 0 0 12 .3Z"
                fill="currentColor"
              />
            </svg>
          </a>
        </div>

        <div className="flex flex-1 items-center py-20 md:py-28">
          <div className="max-w-3xl">
            <h1 className="font-heading text-5xl leading-[0.95] tracking-[-0.055em] text-white md:text-7xl lg:text-8xl">
              {isDenied
                ? "Access denied."
                : "Grade submissions in one conversation."}
            </h1>

            <div className="mt-10 flex flex-col gap-4 sm:mt-12 sm:flex-row sm:items-center">
              {isDenied ? (
                <button
                  className="inline-flex w-full items-center justify-center rounded-full border border-[#d9d9d9] bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#f7f7f7] sm:w-auto"
                  onClick={() => router.replace("/")}
                  type="button"
                >
                  Go back
                </button>
              ) : (
                <button
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-[#d9d9d9] bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#f7f7f7] sm:w-auto"
                  onClick={() => void signIn("google", { redirectTo: "/chat" })}
                  type="button"
                >
                  <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24">
                    <path
                      d="M22 12.27c0-.77-.07-1.51-.2-2.23H12v4.22h5.6a4.8 4.8 0 0 1-2.08 3.15v2.62h3.37c1.97-1.82 3.11-4.5 3.11-7.76Z"
                      fill="#000000"
                    />
                    <path
                      d="M12 22c2.7 0 4.96-.9 6.61-2.44l-3.37-2.62c-.93.63-2.13 1-3.24 1-2.49 0-4.6-1.68-5.35-3.95H3.16v2.7A9.98 9.98 0 0 0 12 22Z"
                      fill="#4a4a4a"
                    />
                    <path
                      d="M6.65 13.99A6 6 0 0 1 6.35 12c0-.69.12-1.36.3-1.99v-2.7H3.16A10 10 0 0 0 2 12c0 1.61.39 3.13 1.16 4.69l3.49-2.7Z"
                      fill="#808080"
                    />
                    <path
                      d="M12 6.06c1.47 0 2.79.5 3.83 1.48l2.87-2.87C16.95 3.02 14.7 2 12 2A9.98 9.98 0 0 0 3.16 7.31l3.49 2.7c.75-2.27 2.86-3.95 5.35-3.95Z"
                      fill="#1f1f1f"
                    />
                  </svg>
                  Continue with Google
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
