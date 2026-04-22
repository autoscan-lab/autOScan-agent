# autOScan-agent — roadmap & backlog

This file tracks planned work for **autOScan-agent** in light of what **autOScan-engine** actually exposes over HTTP and what the web app implements today.

---

## What the engine service exposes (today)

The Python FastAPI service in [autOScan-engine/service/main.py](https://github.com/autoscan-lab/autOScan-engine) (see also [autOScan-engine/CLOUD_SETUP.md](https://github.com/autoscan-lab/autOScan-engine)) is intentionally small:

| Method | Path | Role |
|--------|------|------|
| `GET` | `/health` | Liveness |
| `POST` | `/setup/{assignment}` | Pull policy + assets for that assignment from R2 (`assignments/{assignment}/…`) and activate config |
| `POST` | `/grade` | Multipart field `file` = submissions zip; runs `autoscan-bridge` `run-session`, then per-submission test cases; returns JSON with `summary` and `results[]` (student rows, tests, etc.) |

Auth: optional `X-Autoscan-Secret` (or `ENGINE_SECRET` empty in dev).

**Not exposed as HTTP** (but available in-engine via Go / bridge): `run-test-case` for a single submission, `diff_payload`, discovery-only flows, `pkg/engine` as a library. Those are integration points for **future** engine HTTP or for server-side features that shell out to the bridge from this repo.

---

## What autOScan-agent does today

- **Chat + agent:** OpenAI Agents SDK + Groq (model configurable in `src/agents/grading.ts`); tools in `src/agents/tools.ts`.
- **Engine usage:** `POST /setup/{assignment_name}` then `POST /grade` with the user’s zip — matches the engine contract above.
- **State:** MongoDB for chat; R2 for uploads, persisted grading **session JSON** (full engine result + bumps), `latest` pointer, Excel exports. `list_students` / `show_student` / `bump_grade` / `export_grades` are implemented **on top of that stored result**, not as separate engine endpoints.

So the “plan” is: keep the **thin HTTP engine** for heavy grading; grow **agent + R2** for UX, and only add **engine HTTP** when a workflow truly needs a new server-side operation (e.g. re-run one student without re-uploading the whole zip, or server-side report formats).

---

## Near term (align product + docs)

- [ ] **README & docs sync** — `README.md` still mentions “Llama 3.3 70B”; update to match the configured Groq model and point to `docs/DESIGN.md` (Linear theme) if needed.
- [ ] **Observability** — When `/api/chat` fails, ensure operator logs (already logging `cause` in `src/app/api/chat/route.ts`) are enough; optionally return a safe client message without leaking stack traces in production.
- [ ] **Empty vs engine** — Document required env: `ENGINE_URL`, `GROQ_API_KEY`, R2, Mongo, auth — in `.env.example` comments if anything is missing.

---

## Medium term (agent + R2; no engine change)

- [ ] **Inspector & chat parity** — Ensure clear-chat + “latest run” behavior stays correct when sessions are cleared (already addressed via R2 `latest` + DELETE chat state; regression-test).
- [ ] **Tool UX** — Keep tool outputs small for the model; avoid redundant `list_students` right after `grade_submissions` in prompts (already in system instructions).
- [ ] **Export pipeline** — Today Excel is built in the agent via ExcelJS; optional move to a single shared helper or a tiny internal route that only reads from the stored session (still no engine change).

---

## Future (requires engine and/or new contracts)

Only pursue these if product needs can’t be satisfied with “store full `POST /grade` result in R2 + client/agent logic.”

- [ ] **List students as an engine concern** — *Not* needed for listing alone: the engine already returns all students in one `grade` response. A dedicated HTTP “list” endpoint would only make sense with **run IDs** and **server-side run catalog**, which the engine service does not model today.
- [ ] **Per-student re-grade or “fetch submission”** — Would need either: (a) **engine** `POST /grade` accepting a single submission or re-run, or (b) **agent** re-uploading a slice zip / same zip with flags. The bridge already supports `run-test-case` per submission; exposing that over HTTP is an **engine** feature request.
- [ ] **Bumps / overrides authoritative in engine** — Today bumps live in R2 session JSON. If the engine must be source of truth, add an engine API or a small **agent API** that writes bumps and re-exports — design choice, not a current engine feature.
- [ ] **Engine-side export (CSV/JSON)** — Engine has `pkg/export` in Go; the HTTP service could add `GET/POST` export of a run — **engine** change, then agent could call it instead of building XLSX locally.

---

## Backlog (polish)

- [ ] E2E test: attach zip → `grade_submissions` → inspector shows students.
- [ ] Rate limits / size limits on upload routes aligned with Vercel/engine timeouts (`maxDuration` already set on chat).
- [ ] **PixelBlast / WebGL** — Optional `prefers-reduced-motion` to hide or static-fallback the shader.

---

## Reference links

- Engine HTTP: `autOScan-engine/service/main.py` — [`/health`](GET), [`/setup/{assignment}`](POST), [`/grade`](POST).
- Engine setup & R2 layout: `autOScan-engine/CLOUD_SETUP.md`.
- Agent engine client: `src/agents/tools.ts` (`engineBaseUrl`, `gradeWithCurrentEngine`).
