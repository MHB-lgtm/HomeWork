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
  - active file-backed job/review/exam-index persistence
- `packages/local-course-store`
  - active file-backed course/lecture/RAG persistence

## Current architectural boundaries

- The runtime is still primarily file-backed under `HG_DATA_DIR`.
- On `feat/postgres-runtime-slice-1`, the reviews surface now has a narrow Postgres-backed slice when `DATABASE_URL` is configured:
  - `GET /api/reviews/[jobId]`
  - `PUT` / `PATCH /api/reviews/[jobId]`
  - `GET /api/reviews`
- The current workspace also makes these `apps/web` surfaces DB-first when `DATABASE_URL` is configured:
  - `GET` / `POST /api/exams`
  - `GET /api/exams/[examId]`
  - `GET` / `PUT /api/exams/[examId]/index`
  - `GET` / `POST /api/rubrics`
  - `GET /api/rubrics/[examId]/[questionId]`
  - `GET` / `POST /api/courses`
  - `GET /api/courses/[courseId]`
  - `GET` / `POST /api/courses/[courseId]/lectures`
- Exams, rubrics, exam-index metadata, course metadata, and lecture metadata are now DB-authoritative in `apps/web`.
- Filesystem artifacts under `HG_DATA_DIR` remain compatibility exports for unchanged consumers such as `apps/web/src/app/api/jobs/**`, `apps/web/src/app/api/courses/[courseId]/rag/**`, and the legacy worker.
- `@hg/domain-workflow` exists and is tested, but broad runtime adoption is still deferred.
- Keep auth/session concerns separate from grading domain logic.
- Do not change `apps/worker` unless a milestone explicitly includes worker work.
- PostgreSQL + Prisma is still not the full runtime, but it is no longer review-only: the current workspace also contains the full Wave 1 authoring/content migration work.

## Validation guidance

- Run the narrowest relevant validation for the touched area.
- Common repo commands:
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
