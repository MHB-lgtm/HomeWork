# Supabase Runtime Cutover Runbook

Status: implemented runbook for `feat/supabase-runtime-cutover`; requires real Supabase project credentials to execute
Last updated: 2026-04-16

## 1. Purpose

Define the one-time operational cutover from:

- Neon-backed Postgres
- local persistent runtime asset bytes under `HG_DATA_DIR`

to:

- Supabase Postgres
- private Supabase Storage

This runbook is current-state-first:

- the branch already contains the storage adapter, object-storage-aware runtime reads/writes, worker materialization, and the cutover script
- the actual live cutover still requires real Supabase infrastructure, envs, and an intentional maintenance window

## 2. Required environment

These env vars are required for the target Supabase runtime:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

These remain unchanged:

- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `GEMINI_API_KEY`

`HG_DATA_DIR` still exists, but after cutover it is only for:

- worker temp/derived files
- local-file fallback
- rollback/debug leftovers
- explicit offline tooling

## 3. Supabase setup

Provision a fresh Supabase project and create one private bucket for runtime assets.

Recommended bucket characteristics:

- private
- no public read
- accessed only by trusted server/runtime code using `SUPABASE_SERVICE_ROLE_KEY`

Recommended DB usage:

- `DATABASE_URL` = Supabase pooled connection
- `DATABASE_URL_UNPOOLED` = Supabase direct/session connection

## 4. Runtime code that is already cutover-ready

Implemented on this branch:

- `@hg/postgres-store` runtime asset storage adapter with:
  - local-file backend
  - supabase-object-storage backend
- object-storage-aware writes for:
  - exams
  - assignment backing exam/prompt assets
  - lecture assets
  - job submissions / question fallbacks / exam snapshots
- object-storage-aware reads for:
  - assignment prompt streaming
  - review submission streaming
  - job submission streaming
  - worker exam-index reads
  - course RAG lecture reads
- worker-side asset materialization so grading/localization code still runs on local paths
- cutover command:
  - `pnpm.cmd --filter @hg/postgres-store cutover:supabase`

## 5. Pre-cutover checks

Before the maintenance window:

1. confirm the branch is clean except for intentional local notes
2. confirm Supabase Postgres and bucket exist
3. confirm env values are available locally but not yet switched for normal runtime
4. confirm `pg_dump` and `psql` are installed and on `PATH`
5. confirm the current `HG_DATA_DIR` contains the runtime assets you want to migrate

## 6. One-time cutover sequence

1. Stop local writers:
   - stop `pnpm.cmd dev:web`
   - stop `pnpm.cmd --filter worker job:run-loop`
2. Take the final DB export from Neon and import it into Supabase through the cutover script.
3. Upload runtime assets to Supabase Storage and rewrite `StoredAsset` rows.
4. Switch local envs to Supabase DB + Storage.
5. Run automated validation.
6. Run the manual smoke.
7. Resume normal use.

## 7. Cutover command

Full cutover with DB transfer and asset rewrite:

```powershell
pnpm.cmd --filter @hg/postgres-store cutover:supabase -- --data-dir "C:\path\to\HG_DATA_DIR" --from-database-url "<neon-url>" --to-database-url "<supabase-direct-url>"
```

Asset rewrite only, when DB was already imported separately:

```powershell
pnpm.cmd --filter @hg/postgres-store cutover:supabase -- --data-dir "C:\path\to\HG_DATA_DIR" --skip-db-transfer --to-database-url "<supabase-direct-url>"
```

Dry run:

```powershell
pnpm.cmd --filter @hg/postgres-store cutover:supabase -- --data-dir "C:\path\to\HG_DATA_DIR" --skip-db-transfer --dry-run
```

Operational notes:

- the script shells out to `pg_dump` and `psql` for DB transfer
- the script migrates `StoredAsset` rows with `storageKind in (LOCAL_FILE, UNKNOWN)`
- the script rewrites:
  - `storageKind -> OBJECT_STORAGE`
  - `path -> bucket-relative object key`
- local files are not deleted by the script

## 8. Automated validation after env switch

Run:

```powershell
pnpm.cmd --filter @hg/postgres-store prisma:validate
pnpm.cmd --filter @hg/postgres-store build
pnpm.cmd --filter @hg/postgres-store test
pnpm.cmd --filter web exec tsc -p tsconfig.json --noEmit
pnpm.cmd --filter worker build
pnpm.cmd --filter web build
```

## 9. Manual smoke after cutover

1. Boot `web` and `worker` against the Supabase env.
2. Sign in as `Demo Course Admin`.
3. Create an assignment with a PDF prompt.
4. Confirm the prompt asset row is `OBJECT_STORAGE`.
5. Sign in as `Demo Student`.
6. Open the assignment PDF successfully.
7. Submit a solution PDF or image.
8. Confirm the worker processes it successfully.
9. Open `/reviews/[jobId]` and confirm submission rendering still works.
10. Publish and confirm student `/results` still works.
11. Have the partner run local `web` against the same env and confirm they see the same assignments, reviews, and results.

## 10. Expected post-cutover truth

After the one-time cutover is complete:

- Supabase Postgres is the shared runtime DB
- Supabase Storage is the authoritative persistent runtime asset store
- `HG_DATA_DIR` is no longer authoritative for persistent runtime assets
- local `web` / `worker` processes continue to work, but they do so against a shared backend

## 11. Known limits

- Auth.js is intentionally unchanged in this wave
- worker-derived mini-PDFs and similar temp artifacts still remain local
- the runbook assumes `pg_dump` / `psql` are available locally
- this branch is cutover-ready, but it does not provision the Supabase project for you
