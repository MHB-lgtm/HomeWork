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
  - legacy file-backed job/review/exam-index persistence retained for rollback tooling, archive reads, and debug parity checks
- `packages/local-course-store`
  - legacy file-backed course/lecture/RAG persistence retained for archive/debug parity and compatibility-oriented tooling

## Current architectural boundaries

- The live runtime is now DB-first across Wave 1, Wave 2, Wave 3, and completed Wave 4A surfaces. Remaining filesystem usage under `HG_DATA_DIR` is limited to asset bytes, archive-only leftovers, rollback tooling, and explicit offline compatibility/debug tooling.
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
- The current workspace also makes these derived-runtime surfaces DB-first in Wave 3:
  - `GET` / `PUT /api/exams/[examId]/index`
  - `GET /api/courses/[courseId]/rag/manifest`
  - `POST /api/courses/[courseId]/rag/rebuild`
  - `POST /api/courses/[courseId]/rag/query`
  - `POST /api/courses/[courseId]/rag/suggest`
  - `apps/worker/src/scripts/generateExamIndex.ts`
  - `apps/worker/src/core/loadExamIndex.ts`
  - `apps/worker/src/core/listExamQuestionIds.ts`
  - `apps/worker/src/core/attachStudyPointers.ts`
- The current workspace also completes Wave 4A:
  - live `POST /api/exams`, `POST /api/rubrics`, `POST /api/courses`, and `POST /api/courses/[courseId]/lectures` no longer materialize compatibility files
  - DB-backed metadata reads for exams, rubrics, courses, and lectures no longer require `HG_DATA_DIR`
  - `import:file-backed` emits compatibility files only when `--emit-compat-files` is passed
- Exams, rubrics, exam-index state, course metadata, lecture metadata, course RAG state, jobs, worker heartbeat, and review runtime are now DB-authoritative.
- Filesystem artifacts under `HG_DATA_DIR` remain archive-only leftovers, explicit offline compatibility/debug artifacts, rollback tooling, and asset storage only.
- Wave 2 also includes offline rollback tooling via `pnpm --filter @hg/postgres-store rollback:export-jobs`, which exports `PENDING` / `RUNNING` DB jobs back into the legacy queue shape only for rollback drills.
- `@hg/domain-workflow` exists and is tested, but broad runtime adoption is still deferred.
- Keep auth/session concerns separate from grading domain logic.
- PostgreSQL + Prisma is now the live runtime source of truth for application state. Remaining filesystem usage is asset bytes plus compatibility/archive/debug artifacts, not authoritative JSON runtime state.

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
