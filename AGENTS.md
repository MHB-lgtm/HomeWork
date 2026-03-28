# AGENTS.md

## Working rules

- Keep diffs minimal.
- Do not make unrelated refactors.
- Plan first for multi-step work.
- Treat `ARCHITECTURE.md` and the active file under `plans/` as the repo source of truth.
- Keep docs current-state-first and explicit about implemented vs planned vs deferred.
- Preserve backward compatibility unless a milestone explicitly approves a break.
- Report files changed, validations run, and remaining risks in closeouts.

## Repo layout

- `apps/web`
  - UI routes and HTTP APIs
- `apps/worker`
  - background grading and exam-index processing
- `packages/shared-schemas`
  - current wire/runtime schemas
- `packages/domain-workflow`
  - canonical domain entities, rules, and repository interfaces
- `packages/local-job-store`
  - legacy file-backed job/review/exam-index persistence retained for rollback tooling and unchanged exam-index consumers
- `packages/local-course-store`
  - file-backed course/lecture/RAG persistence still used for RAG and other unchanged consumers

## Current architectural boundaries

- The runtime is now hybrid: Wave 1 authoring/content surfaces and Wave 2 jobs/reviews/health runtime are DB-first, while RAG, exam-index helpers, compatibility exports, and asset bytes still rely on `HG_DATA_DIR`.
- On `feat/postgres-runtime-slice-1`, the reviews surface now has a Postgres-backed slice when `DATABASE_URL` is configured:
  - `GET /api/reviews/[jobId]`
  - `PUT` / `PATCH /api/reviews/[jobId]`
  - `GET /api/reviews`
  - `GET /api/reviews/[jobId]/submission`
  - `GET /api/reviews/[jobId]/submission-raw`
  - `POST /api/reviews/[jobId]/publish`
- The current workspace also makes these `apps/web` surfaces DB-first when `DATABASE_URL` is configured:
  - `GET` / `POST /api/exams`
  - `GET /api/exams/[examId]`
  - `GET` / `PUT /api/exams/[examId]/index`
  - `GET` / `POST /api/rubrics`
  - `GET /api/rubrics/[examId]/[questionId]`
  - `GET` / `POST /api/courses`
  - `GET /api/courses/[courseId]`
  - `GET` / `POST /api/courses/[courseId]/lectures`
- The current workspace also makes these job/worker surfaces DB-first in Wave 2:
  - `POST /api/jobs`
  - `GET /api/jobs/[id]`
  - `GET /api/jobs/[id]/submission`
  - `GET /api/jobs/[id]/submission-raw`
  - `GET /api/health`
  - `apps/worker/src/scripts/runLoop.ts`
  - `apps/worker/src/scripts/runOnce.ts`
  - `apps/web/src/app/api/reviews/**`
  - runtime review writes for new DB-authored jobs
- Exams, rubrics, exam-index metadata, course metadata, lecture metadata, jobs, worker heartbeat, and review runtime are now DB-authoritative.
- Filesystem artifacts under `HG_DATA_DIR` remain compatibility exports or archive-only leftovers for unchanged consumers such as `apps/web/src/app/api/courses/[courseId]/rag/**`, exam-index/rubric readers in the worker, and offline rollback drills.
- Wave 2 also includes offline rollback tooling via `pnpm --filter @hg/postgres-store rollback:export-jobs`, which exports `PENDING` / `RUNNING` DB jobs back into the legacy queue shape only for rollback drills.
- `@hg/domain-workflow` exists and is tested, but broad runtime adoption is still deferred.
- Keep auth/session concerns separate from grading domain logic.
- PostgreSQL + Prisma is still not the full runtime, but it is no longer review-only: the current workspace contains the full Wave 1 authoring/content migration work plus completed Wave 2 job/worker cutover work.

## Validation guidance

- Run the narrowest relevant validation for the touched area.
- Common repo commands:
  - `pnpm --filter @hg/postgres-store build`
  - `pnpm --filter @hg/postgres-store test`
  - `pnpm --filter @hg/postgres-store prisma:validate`
  - `pnpm --filter @hg/postgres-store prisma:generate`
  - `pnpm --filter @hg/domain-workflow build`
  - `pnpm --filter @hg/domain-workflow test`
  - `pnpm --filter @hg/local-job-store build`
  - `pnpm --filter @hg/local-course-store build`
  - `pnpm --filter web build`
  - `pnpm --filter worker build`
- On Windows PowerShell setups that block `pnpm.ps1`, use `pnpm.cmd`.

## Done means

- code, docs, and plans match the actual repo state
- touched validations pass or remaining manual steps are stated explicitly
- no hidden scope expansion was introduced
