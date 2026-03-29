# Project Context Handoff

Last updated: 2026-03-29
Purpose: high-signal handoff for a fresh engineer or fresh model

## 1. Project description

Homework Grader is a pnpm monorepo for a grading system that now runs as a DB-first live runtime with local files retained for asset bytes and explicit offline/archive tooling.

The repo now has:

- the original file-backed grading runtime,
- a completed storage-agnostic domain foundation package,
- a committed Postgres + Prisma review and publication slice on the current branch,
- completed Wave 1 changes that make exams, rubrics, exam-index metadata, courses, and lectures DB-first in `apps/web` while preserving filesystem compatibility exports for unchanged consumers,
- completed Wave 2 changes that make live jobs, reviews, and worker health DB-first while keeping rollback export and leftover file artifacts outside the live runtime path.
- completed Wave 3 changes that make live exam-index reads, course RAG, and study-pointer retrieval DB-first while leaving filesystem artifacts as compatibility or debug-only leftovers.
- completed Wave 4A changes that remove live compatibility writes and narrow `HG_DATA_DIR` to asset-byte paths plus explicit offline/archive tooling.
- implemented offline rollback tooling that can export `PENDING` / `RUNNING` DB jobs back into the legacy queue shape for rollback drills only.

## 2. Repo structure and responsibilities

### Apps

- `apps/web`
  - Next.js App Router application
  - owns pages, APIs, upload boundaries, and current review/course UX
- `apps/worker`
  - background worker for DB-backed grading jobs and exam-index generation

### Packages

- `packages/shared-schemas`
  - current wire/runtime Zod schemas and TypeScript contracts
- `packages/domain-workflow`
  - canonical domain entities, states, repository interfaces, services, and projections
- `packages/local-job-store`
  - legacy file-backed job/review/exam-index persistence retained for rollback/export tooling, archive reads, and debug parity checks
- `packages/local-course-store`
  - legacy file-backed course/lecture/RAG persistence retained for archive/debug parity and compatibility-oriented tooling
- `packages/postgres-store`
  - Prisma schema, migrations, import tooling, Postgres review/publication persistence, Wave 1 content stores, completed Wave 2 job/worker runtime stores, completed Wave 3 derived-runtime stores, and completed Wave 4A cleanup work

### Plans and docs

- `ARCHITECTURE.md`
  - canonical current-state architecture document
- `plans/domain-workflow-foundation.md`
  - record of the completed domain-foundation milestone
- `plans/auth-foundation.md`
  - deferred auth/session milestone plan
- `plans/postgres-prisma-identity-design.md`
  - approved persistence and identity design direction beyond the original review slice
- `plans/postgres-wave-2-execution-plan.md`
  - current execution record for completed Wave 2
- `plans/postgres-wave-3-execution-plan.md`
  - current execution record for completed Wave 3
- `plans/postgres-wave-4a-execution-plan.md`
  - current execution record for completed Wave 4A

## 3. Current milestone status

Completed:

- `Domain & Workflow Foundation`
- `Postgres Runtime Slice 1`
- `Postgres Runtime Slice 2`
- `Postgres Publication Slice 1`
- `Postgres Publication Slice 2`
- `Wave 1`
- `Wave 2`
- `Wave 3`
- `Wave 4A`

Current branch context:

- branch: `feat/postgres-runtime-slice-1`
- the Postgres runtime review and publication slices are already committed on this branch
- the current workspace also contains completed Wave 1 exam/rubric/exam-index/course/lecture migration work
- the current workspace also contains completed Wave 2 job/worker/runtime cutover work
- the current workspace also contains completed Wave 3 exam-index/RAG/study-pointer cutover work
- the current workspace also contains completed Wave 4A cleanup of live compatibility writes and broad `HG_DATA_DIR` metadata-read requirements
- do not assume the local master cutover plan is tracked without checking `git status`

## 4. What is already implemented

- Next.js APIs and UI for exams, reviews, rubrics, courses, and jobs
- DB-backed worker loop for new grading jobs
- course lecture ingestion plus lexical RAG index
- `@hg/domain-workflow` with:
  - canonical entities
  - state models
  - repository interfaces
  - publish-boundary contracts
  - services and tests
- thin local-store domain adapters for current file-backed data
- `packages/postgres-store` with:
  - Prisma schema and migrations
  - rerunnable file-backed import
  - `--dry-run`
  - structured import reporting
- committed review/publication Postgres runtime adoption:
  - `GET /api/reviews/[jobId]`
  - `PUT` / `PATCH /api/reviews/[jobId]`
  - `GET /api/reviews`
  - `GET /api/reviews/[jobId]/submission`
  - `GET /api/reviews/[jobId]/submission-raw`
  - `POST /api/reviews/[jobId]/publish`
  - `context.publication` on imported review detail
  - `publication` summary on imported review list rows
  - `/reviews` as the current lecturer-facing published lens
- completed Wave 1 runtime adoption:
  - `GET` / `POST /api/exams`
  - `GET /api/exams/[examId]`
  - `GET` / `PUT /api/exams/[examId]/index`
  - `GET` / `POST /api/rubrics`
  - `GET /api/rubrics/[examId]/[questionId]`
  - `GET` / `POST /api/courses`
  - `GET /api/courses/[courseId]`
  - `GET` / `POST /api/courses/[courseId]/lectures`
  - `apps/worker/src/scripts/generateExamIndex.ts` saving exam-index metadata only to Postgres in normal runtime
- completed Wave 2 runtime adoption:
  - `POST /api/jobs`
  - `GET /api/jobs/[id]`
  - `GET /api/jobs/[id]/submission`
  - `GET /api/jobs/[id]/submission-raw`
  - `GET /api/health`
  - `GET /api/reviews` listing only runtime DB jobs plus imported DB reviews
  - `GET /api/reviews/[jobId]` returning DB-backed empty review context for pending runtime jobs with no saved version yet
  - `PUT` / `PATCH /api/reviews/[jobId]` and `POST /api/reviews/[jobId]/publish` working for new DB-authored jobs through `Submission.legacyJobId`
  - `apps/worker/src/scripts/runLoop.ts` and `runOnce.ts` claiming jobs from Postgres with explicit lease renewal
  - live runtime no longer writing or reading `jobs/*.json`, `reviews/*.json`, or `worker/heartbeat.json`
  - `pnpm --filter @hg/postgres-store rollback:export-jobs` exporting `PENDING` / `RUNNING` DB jobs into legacy queue files only as offline rollback tooling
- completed Wave 3 runtime adoption:
  - `GET` / `PUT /api/exams/[examId]/index`
  - `GET /api/courses/[courseId]/rag/manifest`
  - `POST /api/courses/[courseId]/rag/rebuild`
  - `POST /api/courses/[courseId]/rag/query`
  - `POST /api/courses/[courseId]/rag/suggest`
  - `apps/worker/src/core/loadExamIndex.ts`
  - `apps/worker/src/core/listExamQuestionIds.ts`
  - `apps/worker/src/core/attachStudyPointers.ts`
  - `apps/worker/src/scripts/generateExamIndex.ts` writing only to Postgres in normal runtime
  - `CourseRagIndex` / `CourseRagChunk` lexical RAG runtime state in Postgres
- completed Wave 4A runtime cleanup:
  - live `POST /api/exams`, `POST /api/rubrics`, `POST /api/courses`, and `POST /api/courses/[courseId]/lectures` no longer materialize compatibility files
  - DB-backed metadata reads for exams and rubrics no longer require `HG_DATA_DIR`
  - `POST /api/courses` no longer requires `HG_DATA_DIR`
  - `import:file-backed` emits compatibility files only when `--emit-compat-files` is passed

## 5. What is intentionally not implemented yet

- Wave 4B legacy runtime/package retirement after the completed Wave 4A cleanup
- committed user identity model in product runtime
- committed memberships or course-scoped authz
- assignment runtime lifecycle
- exam-batch runtime lifecycle
- broader `PublishedResult` / `GradebookEntry` runtime surfaces
- student-facing publication surfaces
- broader publication history UI
- notifications
- analytics snapshots
- export pipelines
- Wave 4B legacy runtime/package retirement after the completed Wave 4A cleanup

## 6. Current persistence model

The repo is now DB-first in live runtime.

Main persisted areas under `HG_DATA_DIR`:

- `jobs/` for archive-only pre-cutover legacy records
- `reviews/` for archive-only pre-cutover legacy records
- `exams/`
- `rubrics/`
- `courses/`
- `uploads/`
- `worker/heartbeat.json` as an archive-only legacy artifact

Current DB-first exceptions in the workspace:

- review detail and review list can use Postgres when `DATABASE_URL` is configured
- imported review assets can be served from `StoredAsset` rows with pointwise fallback
- imported review detail can surface current publication state
- imported review list can surface current effective publication summary
- imported reviews can publish the current review result into `PublishedResult` and `GradebookEntry`
- exams, rubrics, and exam-index metadata are DB-first in `apps/web`
- courses and lectures are DB-first in `apps/web`
- jobs, reviews, and worker health are DB-first in completed Wave 2
- exam-index reads, RAG routes, and study pointers are DB-first in completed Wave 3
- legacy files under `exams/**`, `rubrics/**`, `examIndex.json`, and `courses/**` remain explicit offline compatibility/debug artifacts or archive leftovers only
- leftover `jobs/`, `reviews/`, and `worker/heartbeat.json` files are archive-only and are no longer part of live runtime
- rollback export back into legacy queue files exists only as explicit offline tooling, not as a runtime dual-write path

Runtime code still depends directly on:

- `@hg/postgres-store`
- `@hg/local-course-store`
- `@hg/local-job-store` for rollback-compatible file tooling, archive reads, and debug parity checks
- app-local file helpers for exams and rubrics plus asset-oriented local file reads

## 7. Current domain and publication model

The canonical domain model lives in `packages/domain-workflow`.

Most important concepts:

- `Review`
  - working review aggregate
- `ReviewVersion`
  - append-only history
- `PublishedResult`
  - published truth
- `GradebookEntry`
  - current projection from the effective published result

Important clarification:

- these are implemented as domain contracts and tests,
- the current runtime now adopts DB-backed review/publication flows for imported reviews and DB-authored runtime jobs,
- broader publication, gradebook, and student-facing lifecycle surfaces are still deferred.

## 8. Next milestone

The approved direction is still PostgreSQL + Prisma, and the current workspace has already moved beyond review-only work into completed Wave 1 and completed Wave 2.

Already implemented seams in the workspace:

- `GET /api/reviews/[jobId]`
- `PUT` / `PATCH /api/reviews/[jobId]`
- `GET /api/reviews`
- `GET /api/reviews/[jobId]/submission`
- `GET /api/reviews/[jobId]/submission-raw`
- `POST /api/reviews/[jobId]/publish`
- `POST /api/jobs`
- `GET /api/jobs/[id]`
- `GET /api/jobs/[id]/submission`
- `GET /api/jobs/[id]/submission-raw`
- `GET /api/health`

Bridge rule that still matters:

- route params are bridged through `Submission.legacyJobId`

Recommended next scope:

- move to Wave 4B cleanup and legacy runtime retirement
- keep rollback export offline-only and do not reintroduce live fallback reads
- do not jump to auth before compatibility-write retirement and legacy cleanup land

## 9. Main constraints and do-not-change-yet boundaries

- keep diffs minimal
- do not reintroduce file-authoritative job/review writes for new runtime traffic
- keep `@hg/domain-workflow` storage-agnostic
- do not treat unrelated dirty docs/plans as accepted runtime architecture
- preserve current HTTP shapes unless a milestone explicitly approves a change
- keep auth/authz separate from grading domain logic
- keep docs current-state-first and explicit about implemented vs planned vs deferred

## 10. Validation commands that matter

Current branch validations that matter:

- `pnpm --filter @hg/postgres-store build`
- `pnpm --filter @hg/postgres-store test`
- `pnpm --filter @hg/postgres-store prisma:validate`
- `pnpm --filter @hg/postgres-store prisma:generate`
- `pnpm --filter @hg/domain-workflow build`
- `pnpm --filter @hg/domain-workflow test`
- `pnpm --filter web build`
- `pnpm --filter worker build`

Windows note:

- use `pnpm.cmd` if PowerShell execution policy blocks `pnpm.ps1`

## 11. Exact files/folders to read first

Read these first for current branch understanding:

- `AGENTS.md`
- `ARCHITECTURE.md`
- `plans/domain-workflow-foundation.md`
- `plans/auth-foundation.md`
- `plans/postgres-prisma-identity-design.md`
- `plans/postgres-wave-2-execution-plan.md`
- `plans/postgres-wave-3-execution-plan.md`
- `packages/domain-workflow/src/**`
- `packages/domain-workflow/test/**`
- `packages/shared-schemas/src/**`
- `packages/local-job-store/src/fileJobStore.ts`
- `packages/local-job-store/src/fileReviewStore.ts`
- `packages/local-course-store/src/fileCourseStore.ts`
- `packages/local-course-store/src/fileLectureStore.ts`
- `packages/local-course-store/src/fileCourseRagIndex.ts`
- `packages/postgres-store/**`
- `apps/web/src/app/api/jobs/**`
- `apps/web/src/app/api/health/route.ts`
- `apps/web/src/app/api/reviews/**`
- `apps/web/src/app/reviews/**`
- `apps/web/src/lib/server/persistence.ts`
- `apps/worker/src/lib/heartbeat.ts`
- `apps/worker/src/lib/processNextPendingJob.ts`
- `apps/worker/src/scripts/runLoop.ts`

## 12. Git context to share in a new conversation

Current branch:

- `feat/postgres-runtime-slice-1`

Relevant recent commits:

- `13fe16b feat(postgres): finalize wave 2 with db-only jobs reviews and health runtime`
- `309b67e feat(postgres): add published lens to reviews list`
- `8804be7 feat(postgres): add narrow review publication flow`
- `853d1af docs: align branch handoff and architecture with postgres review slices`
- `302b7fe feat(postgres): make review detail independent of legacy jobs api`
- `245e428 feat(postgres): harden review read side and import flow`
- `4b16945 feat(postgres): finalize first prisma review seam and local db bring-up`

Current dirty context:

- current Wave 1 and Wave 2 work should include:
  - `apps/web/src/app/api/exams/**`
  - `apps/web/src/app/api/jobs/**`
  - `apps/web/src/app/api/health/route.ts`
  - `apps/web/src/app/api/courses/**`
  - `apps/web/src/app/api/rubrics/**`
  - `apps/web/src/app/api/reviews/**`
  - `apps/web/src/lib/server/persistence.ts`
  - `apps/web/src/lib/server/reviewDetail.ts`
  - `apps/worker/src/lib/heartbeat.ts`
  - `apps/worker/src/lib/processNextPendingJob.ts`
  - `apps/worker/src/lib/runtimePersistence.ts`
  - `apps/worker/src/scripts/generateExamIndex.ts`
  - `apps/worker/src/scripts/createJob.ts`
  - `apps/worker/src/scripts/runLoop.ts`
  - `apps/worker/src/scripts/runOnce.ts`
  - `packages/postgres-store/prisma/schema.prisma`
  - `packages/postgres-store/prisma/migrations/**`
  - `packages/postgres-store/src/import-file-backed.ts`
  - `packages/postgres-store/src/queries/course-store.ts`
  - `packages/postgres-store/src/queries/exam-store.ts`
  - `packages/postgres-store/src/queries/rubric-store.ts`
  - `packages/postgres-store/src/queries/exam-index-store.ts`
  - `packages/postgres-store/src/queries/lecture-store.ts`
  - `packages/postgres-store/src/queries/job-store.ts`
  - `packages/postgres-store/src/queries/worker-heartbeat-store.ts`
  - `packages/postgres-store/src/compat/file-materialization.ts`
  - `plans/postgres-wave-1-execution-plan.md`
  - `plans/postgres-wave-2-execution-plan.md`
- always confirm with `git status` before assuming a clean tree

## 13. Copy-paste handoff block

```text
Repo: Homework Grader pnpm monorepo
Canonical docs to read first:
- AGENTS.md
- ARCHITECTURE.md
- plans/domain-workflow-foundation.md
- plans/auth-foundation.md
- plans/postgres-prisma-identity-design.md
- plans/postgres-wave-2-execution-plan.md

Current runtime shape:
- live runtime is DB-first plus file-backed compatibility/archive artifacts under HG_DATA_DIR
- apps/web is DB-first for review/publication seams, Wave 1 authoring/content surfaces, Wave 2 jobs/health, and Wave 3 exam-index/RAG routes
- apps/worker now claims new jobs from Postgres, writes new review state to Postgres, and reads exam-index/study-pointer derived state from Postgres
- @hg/domain-workflow exists and is tested, but broad runtime adoption is still deferred
- current branch has committed Postgres-backed review and publication slices
- imported reviews can publish through POST /api/reviews/[jobId]/publish
- imported review detail can expose context.publication
- imported review list rows can expose publication summary
- /reviews is the current lecturer-facing published lens for imported reviews
- exams, rubrics, exam-index metadata, courses, and lectures are now DB-first in apps/web
- POST /api/jobs, worker queue/lease lifecycle, worker heartbeat, and review runtime are now DB-first in Wave 2
- GET/PUT /api/exams/[examId]/index, course RAG routes, and worker study pointers are now DB-first in Wave 3
- HG_DATA_DIR files under exams/**, rubrics/**, examIndex.json, and courses/** remain compatibility outputs or debug/archive leftovers only
- leftover jobs/, reviews/, and worker/heartbeat.json are archive-only and not part of live runtime
- rollback export to legacy queue files exists only as offline tooling for drills/rollback windows

Current branch context:
- branch: feat/postgres-runtime-slice-1
- recent commits:
  - 13fe16b feat(postgres): finalize wave 2 with db-only jobs reviews and health runtime
  - 245e428 feat(postgres): harden review read side and import flow
  - 4b16945 feat(postgres): finalize first prisma review seam and local db bring-up
  - c1f09e1 docs(plan): add postgres prisma identity design artifact
  - 7577208 docs(plan): add auth foundation planning artifact
  - 3e052c7 docs(architecture): refresh architecture and add planning artifacts
  - 992a1e8 feat(domain): add workflow foundation package and filesystem adapters
- review/publication and Wave 1 authoring/content runtime slices are already committed on this branch

Important code to read:
- packages/domain-workflow/src/**
- packages/shared-schemas/src/**
- packages/local-job-store/src/fileJobStore.ts
- packages/local-job-store/src/fileReviewStore.ts
- packages/local-course-store/src/fileCourseStore.ts
- packages/local-course-store/src/fileLectureStore.ts
- packages/local-course-store/src/fileCourseRagIndex.ts
- packages/postgres-store/**
- apps/web/src/app/api/jobs/**
- apps/web/src/app/api/reviews/**
- apps/web/src/app/api/health/route.ts
- apps/web/src/lib/server/persistence.ts
- apps/worker/src/lib/heartbeat.ts
- apps/worker/src/lib/processNextPendingJob.ts
- apps/worker/src/scripts/runLoop.ts

Key architecture boundary:
- runtime is no longer review-only on the Postgres path: Waves 1, 2, and 3 are active in the workspace
- implemented review seams on this branch:
  - GET /api/reviews/[jobId]
  - PUT/PATCH /api/reviews/[jobId]
  - GET /api/reviews
  - GET /api/reviews/[jobId]/submission*
  - POST /api/reviews/[jobId]/publish
- implemented Wave 2 seams in the workspace:
  - POST /api/jobs
  - GET /api/jobs/[id]
  - GET /api/jobs/[id]/submission*
  - GET /api/health
  - worker runLoop/runOnce DB queue claim plus lease renewal
- implemented Wave 3 seams in the workspace:
  - GET/PUT /api/exams/[examId]/index
  - GET /api/courses/[courseId]/rag/manifest
  - POST /api/courses/[courseId]/rag/rebuild
  - POST /api/courses/[courseId]/rag/query
  - POST /api/courses/[courseId]/rag/suggest
  - worker loadExamIndex/listExamQuestionIds/attachStudyPointers DB-backed
- publication state is visible in both review detail and review list for imported reviews
- Submission.legacyJobId is the bridge from current jobId route params to DB-backed review records
```
