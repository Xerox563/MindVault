# MindVault — Fix TODO (audit as of 2026-08-23)

**Status: all 15 items below implemented and verified 2026-08-23** (persistence/scoping tested directly against Chroma, settings/integrations endpoints exercised end-to-end via FastAPI TestClient, frontend `next build` + `tsc --noEmit` clean). Kept here as the record of what was wrong and what changed.

Ordered by priority. Each item names the exact file(s) and the concrete problem found in the current code.

## P0 — RAG is broken / unreliable

1. **Chroma vector store is in-memory, not persisted**
   `backend/app/services/vectordb.py:4` — `chromadb.Client(Settings())` with no `persist_directory`. Every backend restart wipes all vectors, even though `chunks`/`embeddings` rows survive in SQLite. Result: after any restart, `/api/ask` returns "No relevant documents found" until every file is re-uploaded.
   **Fix:** use `chromadb.PersistentClient(path=...)` pointed at `backend/data/chroma/`, or rebuild the Chroma collection from the `embeddings` table on startup.

2. **Vector search isn't scoped per user**
   `backend/app/services/processor.py:36` stores metadata `{file_id, filename}` only — no `user_id`. `backend/app/services/vectordb.py:16` queries the whole collection top-5 with no filter, and `backend/app/services/rag.py:15-19` filters to the current user *after* the top-5 comes back. With more than a few users/files, a user's own relevant chunks can be pushed out of the top-5 by other users' data, so `/api/ask` silently returns nothing.
   **Fix:** add `user_id` to the Chroma metadata on insert, and pass `where={"user_id": user_id}` into `collection.query(...)`.

3. **Duplicate `MISTRAL_API_KEY` field**
   `backend/app/config.py:7` and `:21` declare the same setting twice — harmless but confusing; remove the first.

## P1 — Multi-provider model selection (Mistral / Ollama / user API keys)

4. **`ollama` Python package missing from requirements**
   `backend/requirements.txt` has no `ollama` entry, but `backend/app/services/llm_service.py:40` does `import ollama`. On a clean install, Ollama silently never initializes (caught by the bare `except`), so "local model" never appears in the model list.
   **Fix:** add `ollama` to `backend/requirements.txt`.

5. **LLM provider selection is a single global, not per-user**
   `backend/app/services/llm_service.py:168` — `llm_service` is a module-level singleton; `current_provider` is one shared value. `POST /api/llm/set-provider/{id}` (`backend/app/api/chat.py:56`) mutates it for *every* user on the server. Two users picking different models will stomp on each other.
   **Fix:** store the selected provider/model per-user (new column on `User`, e.g. `preferred_provider`), pass it explicitly into `generate_chat_response`/`generate_embedding` instead of relying on shared mutable state.

6. **No way to add an API key from the UI**
   There is no backend endpoint or dashboard "config" menu to save a Mistral/OpenAI/other API key — `MISTRAL_API_KEY` only comes from `backend/.env` at process start, and `LLMService._init_mistral()` runs once in `__init__`. This is the user's core ask ("user can add api key from the ui... once api key is set then it shows in the prompt model selection").
   **Fix (backend):**
   - Add `api_keys` table or JSON column on `User` (encrypted at rest) keyed by provider.
   - Add `GET/PUT /api/settings/api-keys` endpoints.
   - Change `LLMService` to accept a per-user key at call time (build the client on demand instead of only at startup) so a newly-saved key becomes usable immediately, no restart.
   **Fix (frontend):** add a "Settings / Config" entry (gear icon in header or sidebar) opening a modal with provider name + API key input + Save, calling the new endpoint; on save, refresh `fetchLLMStatus()` so the new provider shows up in the model selector immediately.

7. **Model list only ever shows what's in `.env` at boot**
   `backend/app/api/chat.py:44-54` (`/api/llm/status`) just reflects `llm_service.get_available_providers()`, which was computed from providers initialized at process start (#6). Once (6) is fixed, this endpoint needs to re-check "does this user have a key saved" rather than only server-wide env config.

8. **Ollama model list isn't refreshed opportunistically**
   `llm_service.py:76-90` calls `ollama.list()` on every `/api/llm/status` call (fine), but if Ollama isn't running at backend startup, `self.providers['ollama']` is permanently `None` (set once in `__init__`, `backend/app/services/llm_service.py:56`) and never retried — starting Ollama later requires a backend restart.
   **Fix:** lazily re-probe Ollama in `get_available_providers()` instead of caching a permanent `None`.

## P1 — Google Drive integration

9. **`DriveConnect.tsx` is dead code / wired wrong, and isn't used anywhere**
   `src/components/DriveConnect.tsx` fetches `GET /api/auth/google/connect` and expects **JSON** `{ auth_url }`, but `backend/app/api/drive.py:30-78` (`connect_google`) returns a **redirect** (`RedirectResponse`) and requires the token as a **query param**, not an `Authorization` header. The component is never imported by `src/app/dashboard/page.tsx`, so there is currently no way to connect Google Drive from the actual dashboard at all.
   **Fix:** either (a) make `connect_google` return `{"auth_url": ...}` as JSON and have the frontend open it in a popup (`window.open`) so the existing `google_callback` popup-close/`postMessage` flow works, or (b) keep the redirect and navigate the whole page — pick one and make frontend/backend agree. Popup flow (a) is preferable since `google_callback` already assumes `window.opener`.

10. **Dashboard has no Drive UI wired up at all**
    `src/app/dashboard/page.tsx` declares `integrations`/`showIntegrations` state (lines 115-116) but nothing ever calls `setIntegrations(...)` — the "+" button that opens the integrations panel (line 556) is permanently hidden because `integrations.length` is always 0, and there's no modal/panel implementation for it either.
    **Fix:** add a `fetchIntegrations()` that checks `current_user.google_refresh_token` (new small `GET /api/integrations` endpoint), render a Drive-connect button + connected-Drive-files list (reusing `/api/drive/files` and `/api/sync/drive/{file_id}` which already exist and work), and build the missing integrations panel UI (currently `showIntegrations` has no corresponding render block).

11. **Drive-synced files never get embedded into the vector store's user scope**
    `backend/app/api/drive.py:196-201` calls `process_file(db, file_record)` correctly, but this inherits bug #2 (no `user_id` in Chroma metadata) — same fix covers both local uploads and Drive syncs.

## P2 — Auth/perf cleanup (not blocking, but worth listing)

12. **Every authenticated request round-trips to Clerk's API twice**
    `backend/app/utils/deps.py` (`verify_clerk_token`, `get_current_user`) makes 2 external HTTP calls to `api.clerk.com` per request (session verify + user lookup), with no caching. This adds real latency to every single API call including `/api/ask`.
    **Fix:** cache verified `(token → user)` for a short TTL (e.g. in-memory dict or Redis, 60s), or verify Clerk JWTs locally via JWKS instead of calling the Clerk API each time.

13. **Legacy JWT fallback path (`backend/app/utils/auth.py`) is effectively dead** since Clerk is now the real auth — either remove it or confirm it's intentionally kept as a fallback; currently it's undocumented which one is authoritative.

## P2 — Repo hygiene

14. **Compiled `.pyc` files and the SQLite DB are committed to git** (`git status` shows `backend/app/**/__pycache__/*.pyc` and `backend/data/mindvault.db` modified/tracked). `.gitignore` has no Python or `venv`/`data` rules at all.
    **Fix:** add `__pycache__/`, `*.pyc`, `backend/venv/`, `backend/data/*.db`, `backend/data/uploads/*` to `.gitignore`, then `git rm --cached` the currently-tracked ones.

15. **`todo.md` (root) is the original Phase-1 plan and is stale** — it still describes JWT-only auth and doesn't mention Clerk, Ollama, or the dashboard redesign that already shipped. Worth trimming/archiving so it doesn't mislead future work; this file (`FIXES_TODO.md`) is the current source of truth for outstanding fixes.

---

### Suggested order of attack
1. Fix #1, #2 (persist + scope Chroma) — RAG stops silently failing.
2. Fix #4 (add `ollama` to requirements) — local models actually load.
3. Fix #6 + #5 (per-user API keys, settings endpoint, config UI) — the big feature ask.
4. Fix #9 + #10 (Drive popup flow + dashboard integrations panel) — Drive becomes usable end-to-end.
5. Fix #3, #12, #14, #15 — cleanup, can be done anytime.
