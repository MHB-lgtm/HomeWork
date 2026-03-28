# Postgres Wave 2 Execution Plan

Status: Wave 2A implemented, Wave 2B pending
Last updated: 2026-03-28

## Summary

Wave 2 is split into:

- `W2A`: jobs API, DB queue/lease lifecycle, worker heartbeat, new review writes, and new review publication
- `W2B`: cleanup of active file-backed job/review/health runtime paths

This execution record now reflects implemented `W2A` behavior:

- `POST /api/jobs` is DB-first
- worker queue claim/complete/fail is DB-first
- worker heartbeat is DB-first
- new job reviews are DB-first
- imported legacy reviews remain readable
- pre-cutover file jobs remain read-only fallback during `W2A`

## Implemented W2A Boundary

Authoritative runtime state moved to Postgres for new jobs:

- `GradingJob`
- `WorkerHeartbeat`
- submission asset ownership for new runtime jobs
- new runtime review persistence through Postgres-backed review versions

DB-first runtime surfaces in `apps/web`:

- `POST /api/jobs`
- `GET /api/jobs/[id]`
- `GET /api/jobs/[id]/submission`
- `GET /api/jobs/[id]/submission-raw`
- `GET /api/health`
- DB-first resolution for new jobs inside:
  - `GET /api/reviews`
  - `GET /api/reviews/[jobId]`
  - `GET /api/reviews/[jobId]/submission`
  - `GET /api/reviews/[jobId]/submission-raw`
  - `PUT` / `PATCH /api/reviews/[jobId]`
  - `POST /api/reviews/[jobId]/publish`

Worker runtime in `W2A`:

- `runLoop` and `runOnce` claim jobs from Postgres
- lease renewal is explicit and independent of the health heartbeat
- job completion/failure updates Postgres only
- no normal-runtime writes to `jobs/*.json`, `reviews/*.json`, or `worker/heartbeat.json`

Rollback tooling in `W2A`:

- `pnpm --filter @hg/postgres-store rollback:export-jobs` exists as explicit offline tooling
- it exports only `PENDING` / `RUNNING` DB jobs back into `jobs/pending/*.json` or `jobs/running/*.json`
- it exports `reviews/<jobId>.json` only when a current DB review version exists
- it is not called from web or worker runtime code

## Fallback Rules

`W2A` keeps read-only fallback only for legacy leftover traffic:

- `/api/jobs/[id]` and submission asset routes:
  - DB-first
  - file-backed fallback only when no DB job exists
- `/api/reviews/**`:
  - DB runtime jobs first
  - imported legacy DB reviews second
  - file-backed legacy fallback last
- `/api/health`:
  - DB heartbeat first
  - file-backed fallback only when no DB heartbeat exists yet

Write-path rule:

- new writes do not fall back to file-backed queue or review files
- rollback export exists only as tooling, not as a live peer write path

## Validation Summary

Build/test matrix kept green:

- `pnpm.cmd --filter @hg/postgres-store prisma:validate`
- `pnpm.cmd --filter @hg/postgres-store prisma:generate`
- `pnpm.cmd --filter @hg/postgres-store build`
- `pnpm.cmd --filter @hg/postgres-store test`
- `pnpm.cmd --filter @hg/domain-workflow build`
- `pnpm.cmd --filter @hg/domain-workflow test`
- `pnpm.cmd --filter web build`
- `pnpm.cmd --filter worker build`
- `pnpm.cmd --filter @hg/postgres-store exec prisma migrate deploy --schema prisma/schema.prisma`

Importer validation:

- dry-run: `jobsPending=3 jobsRunning=0 jobsDone=50 jobsFailed=6 unresolved=46 failed=0`
- real run: same job counts, `unresolved=46 failed=0`
- second real run: same job counts, `unresolved=46 failed=0`
- unresolved legacy jobs are explicit and mainly caused by missing `examId` or missing `examFilePath` in older file-backed records

Manual smoke summary:

- rollback drill:
  - created pending DB-authored job `job-1774735229429-3vl3cz6`
  - saved a current DB review version while still pending
  - exported that pending job through `rollback:export-jobs`
  - confirmed `@hg/local-job-store` could read both exported job and exported review files
- runtime drill:
  - created DB-authored job `job-1774735349503-9gwnv95`
  - observed `PENDING -> DONE` from DB-backed job status
  - served submission bytes through DB-registered `StoredAsset`
  - returned DB-backed empty review context before completion
  - saved review annotations and patched review metadata through Postgres
  - published the completed review successfully
  - reported worker liveness from DB heartbeat
  - confirmed no `jobs/*.json` or `reviews/*.json` were written for the new runtime job
  - confirmed `worker/heartbeat.json` mtime stayed unchanged when DB heartbeat writes ran

## Rollback Window

`W2A` rollback is limited and explicit:

- stop DB-backed worker loop
- export pending/running DB jobs into legacy file queue only if rollback is needed
- keep DB rows for audit/replay
- do not re-enable live dual-write after cutover

## W2B Next

`W2B` remains the cleanup wave:

- remove active `/api/jobs/**` fallback to local job files
- remove file-backed health fallback
- remove active runtime dependence on file-backed review/job metadata for current traffic
- make legacy queue drain-only or archive-only
