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
  - UI routes, HTTP APIs, and the web auth/session boundary
- `apps/worker`
  - background grading and exam-index processing
- `packages/shared-schemas`
  - current wire/runtime schemas
- `packages/domain-workflow`
  - canonical domain entities, rules, and repository interfaces
- `packages/local-job-store`
  - archived file-backed job/review/exam-index code retained for rollback tooling, archive reads, and debug parity checks only
- `packages/local-course-store`
  - archived file-backed course/lecture/RAG code retained for archive/debug parity and compatibility-oriented tooling only

## Current architectural boundaries

- The live runtime is now DB-first across completed Waves 1-4. Remaining filesystem usage under `HG_DATA_DIR` is limited to asset bytes, archive-only leftovers, rollback tooling, and explicit offline compatibility/debug tooling.
- `apps/web` now owns the active Auth.js session boundary for the current internal product.
- Current web runtime is private-by-default:
  - non-auth pages require authenticated users
  - current staff pages require authenticated staff access
  - non-auth API routes require authenticated users, with staff or course-role enforcement applied server-side
  - `/api/health` requires `SUPER_ADMIN`
  - `/courses` and `/api/courses/**` now enforce real course-scoped staff authorization where the repo model supports it
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
- The current workspace also completed Wave 4A:
  - live `POST /api/exams`, `POST /api/rubrics`, `POST /api/courses`, and `POST /api/courses/[courseId]/lectures` no longer materialize compatibility files
  - DB-backed metadata reads for exams, rubrics, courses, and lectures no longer require `HG_DATA_DIR`
  - `import:file-backed` emits compatibility files only when `--emit-compat-files` is passed
- The current workspace also completed Wave 4B:
  - `apps/web` and `apps/worker` no longer import `@hg/local-job-store` or `@hg/local-course-store` for live runtime
  - `apps/worker` now uses a worker-local `WorkerJobRecord` type instead of the archived `JobRecord` contract
  - the disabled legacy `job:create` entrypoint and unused file-backed web helpers have been removed from live packages
- Exams, rubrics, exam-index state, course metadata, lecture metadata, course RAG state, jobs, worker heartbeat, and review runtime are now DB-authoritative.
- Filesystem artifacts under `HG_DATA_DIR` remain archive-only leftovers, explicit offline compatibility/debug artifacts, rollback tooling, and asset storage only.
- Wave 2 also includes offline rollback tooling via `pnpm --filter @hg/postgres-store rollback:export-jobs`, which exports `PENDING` / `RUNNING` DB jobs back into the legacy queue shape only for rollback drills.
- `@hg/domain-workflow` exists and is tested, but broad runtime adoption is still deferred.
- Keep auth/session concerns separate from grading domain logic.
- Course-scoped authorization is now implemented for `/courses` and `/api/courses/**`, while non-course-owned staff surfaces such as exams, jobs, reviews, and rubrics remain coarse staff-only until ownership is tightened in a later milestone.
- Development-only demo sign-in now exists in `apps/web` through an Auth.js credentials provider that seeds or reuses real Postgres-backed demo users, memberships, and sessions. It is disabled outside development.
- PostgreSQL + Prisma is now the live runtime source of truth for application state. The archived local-store packages remain in-repo only for offline rollback, compatibility, archive, and debug workflows.

## Validation guidance

- Run the narrowest relevant validation for the touched area.
- Common repo commands:
  - `pnpm --filter @hg/postgres-store build`
  - `pnpm --filter @hg/postgres-store test`
  - `pnpm --filter @hg/postgres-store prisma:validate`
  - `pnpm --filter @hg/postgres-store prisma:generate`
  - `pnpm --filter @hg/domain-workflow build`
  - `pnpm --filter @hg/domain-workflow test`
  - `pnpm --filter web build`
  - `pnpm --filter worker build`
- Archived package spot checks only when explicitly editing those packages:
  - `pnpm --filter @hg/local-job-store build`
  - `pnpm --filter @hg/local-course-store build`
- On Windows PowerShell setups that block `pnpm.ps1`, use `pnpm.cmd`.

## Done means

- code, docs, and plans match the actual repo state
- touched validations pass or remaining manual steps are stated explicitly
- no hidden scope expansion was introduced
