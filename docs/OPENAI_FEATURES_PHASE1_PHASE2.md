# AI features — Phase 1 & Phase 2 (simple list + best models)

Plain-language list of what the apps do with AI, and the **strongest model choice** for each (budget ignored). Names are **real API model ids** (or the family your provider exposes).

---

## Phase 1 (job portal / LMS — `backend1`)

- **Turn a uploaded resume into structured profile fields** — **Best model:** `gpt-4.1` or `gpt-4o` (OpenAI). Strong alternates: latest **Claude Sonnet** on your Anthropic account (e.g. `claude-3-5-sonnet-20241022` or newer id from the console), `mistral-large-latest` (Mistral).
- **Short AI blurb on the candidate profile** — **Best model:** `gpt-4.1` or `gpt-4o` · alternates: `claude-3-5-sonnet-20241022`, `mistral-large-latest`.
- **“Improve this paragraph” in the CV / resume editor** — **Best model:** `gpt-4.1` or `gpt-4o` · alternates: `claude-3-5-sonnet-20241022`, `mistral-large-latest`.
- **Match people to jobs with vector similarity** — **Best model (embeddings):** `text-embedding-3-large` (OpenAI). Alternate families: Voyage / Cohere embed if you ever swap the pipeline.
- **Match people to jobs with an LLM “why this fit” score and text** — **Best model:** `gpt-4.1` or `gpt-4o` · alternates: `mistral-large-latest`, Claude Sonnet class.
- **Pull skills, roles, boosts, and explanations in the matching pipeline** — **Best model:** `gpt-4.1` or `gpt-4o`.
- **Field-by-field AI match hints** — **Best model:** `gpt-4.1` or `gpt-4o` · alternates: `gemini-2.0-flash` / `gemini-1.5-pro`, `mistral-large-latest`, `claude-3-5-sonnet-20241022`.
- **Practice interview chat (bot interviewer)** — **Best model:** `gpt-4o` or `gpt-4.1` (more natural multi-turn than old `gpt-3.5-turbo`).
- **LMS: dashboard insight, tips, roadmap, daily nudge, “shared intelligence”** — **Best model:** `gpt-4.1` or `gpt-4o` · alternates already wired in code paths: `mistral-large-latest`, `gemini-1.5-flash` / `gemini-1.5-pro`.
- **LMS: auto interview questions + score answers** — **Best model:** `gpt-4.1` or `gpt-4o` · alternate: `claude-3-haiku-20240307` for speed (code uses Haiku in some fallbacks).
- **LMS: smart actions on notes, resume sections, summaries, ATS check, company research, goals, locations, orchestration** — **Best model:** `gpt-4.1` or `gpt-4o` · alternates: `mistral-large-latest`, `claude-3-5-sonnet-20241022`, `gemini-1.5-pro`.
- **Big “fill this CV section from conversation” flows** — **Best model:** `gpt-4.1` or `gpt-4o` · fallback in code: `mistral-small-latest` / `mistral-large-latest`.

---

## Phase 2 (ATS / CRM — `backendphase2`)

- **Read resume text and fill candidate fields (bulk + single upload)** — **Best model:** `gpt-4.1` or `gpt-4o` (OpenAI). Fallback in app: Mistral via `MISTRAL_CHAT_MODEL` — use **`mistral-large-latest`** if you want strongest Mistral.
- **Floating in-app assistant (asks data, runs tools, proposes CRM actions)** — **Best model:** `gpt-4.1` or `gpt-4o` (best tool + JSON discipline). Set `OPENAI_ASSISTANT_MODEL` to that id.
- **AI write / polish a job description + structured form fields (JSON schema)** — **Best model:** `gpt-4.1` or `gpt-4o` (schema mode is an OpenAI path today).
- **AI “optimize lead” from messy notes (JSON schema)** — **Best model:** `gpt-4.1` or `gpt-4o`.
- **Aria: natural language about leads (intents, duplicates, suggestions)** — **Best model:** same as assistant — **`gpt-4.1` or `gpt-4o`** (today code hardcodes `gpt-4o-mini` for Aria; best quality = point it at the same model as above).
- **Short AI summary after interview feedback is saved** — **Best model:** `gpt-4.1` or `gpt-4o` · alternate: `mistral-large-latest`.

---

## One “if you only remember three things” block

| Kind of work | Best model (pick one stack) |
|--------------|-----------------------------|
| **Embeddings** (job ↔ candidate similarity) | `text-embedding-3-large` |
| **Heavy parsing + JSON + tools** (resumes, assistant, JD, leads) | `gpt-4.1` or `gpt-4o` |
| **OpenAI-down fallback chat** (already in Phase 2) | `mistral-large-latest` via `MISTRAL_CHAT_MODEL` |

---

## Billing note (not budget advice)

The product still bills on **OpenAI Platform API** keys for OpenAI models; Mistral / Anthropic / Google each have their own keys and dashboards. **ChatGPT Individual/Business** is separate from API usage.

---

## Model names that already appear in this repo (reference)

**OpenAI:** `gpt-3.5-turbo`, `gpt-4o`, `gpt-4o-mini`, `text-embedding-3-small` (and upgrade path `text-embedding-3-large`), env `OPENAI_ASSISTANT_MODEL` for Phase 2 chat defaults.

**Mistral:** `mistral-small-latest`, `mistral-medium-latest`, `mistral-large-latest` (Phase 2 default fallback is `mistral-small-latest` unless `MISTRAL_CHAT_MODEL` is set).

**Anthropic:** `claude-3-haiku-20240307`, `claude-3-5-sonnet-20241022`.

**Google:** `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash`, `gemini-pro`.

When OpenAI documents a newer **`gpt-4.1`** (or successor) on your account, prefer that over `gpt-4o-mini` for the same tasks if quality is the only goal.
