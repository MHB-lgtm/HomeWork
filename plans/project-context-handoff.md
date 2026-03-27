# Project Context Handoff

Last updated: 2026-03-27
Purpose: high-signal handoff for a fresh engineer or fresh model

## 1. Project description

Homework Grader is a pnpm monorepo for a grading system that still runs primarily as a local-first, file-backed application.

The repo now has:

- the original file-backed grading runtime,
- a completed storage-agnostic domain foundation package,
- a narrow committed Postgres + Prisma review and publication slice on the current branch.

## 2. Repo structure and responsibilities

### Apps

- `apps/web`
  - Next.js App Router application
  - owns pages, APIs, upload boundaries, and current review/course UX
- `apps/worker`
  - background worker for file-backed grading jobs and exam-index generation

### Packages

- `packages/shared-schemas`
  - current wire/runtime Zod schemas and TypeScript contracts
- `packages/domain-workflow`
  - canonical domain entities, states, repository interfaces, services, and projections
- `packages/local-job-store`
  - active file-backed job/review/exam-index persistence
- `packages/local-course-store`
  - active file-backed course/lecture/RAG persistence
- `packages/postgres-store`
  - Prisma schema, migrations, import tooling, and Postgres review-side persistence/query helpers

### Plans and docs

- `ARCHITECTURE.md`
  - canonical current-state architecture document
- `plans/domain-workflow-foundation.md`
  - record of the completed domain-foundation milestone
- `plans/auth-foundation.md`
  - deferred auth/session milestone plan
- `plans/postgres-prisma-identity-design.md`
  - approved persistence and identity design direction beyond the current review slice

## 3. Current milestone status

Completed:

- `Domain & Workflow Foundation`
- `Postgres Runtime Slice 1`
- `Postgres Runtime Slice 2`
- `Postgres Publication Slice 1`

Current branch context:

- branch: `feat/postgres-runtime-slice-1`
- the Postgres runtime review and publication slices are already committed on this branch
- the working tree should be clean after the publication-slice docs closure

## 4. What is already implemented

- file-backed runtime persistence under `HG_DATA_DIR`
- Next.js APIs and UI for exams, reviews, rubrics, and courses
- worker loop for job processing
- review persistence as `ReviewRecord`
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
- narrow review-surface Postgres runtime adoption:
  - `GET /api/reviews/[jobId]`
  - `PUT` / `PATCH /api/reviews/[jobId]`
  - `GET /api/reviews`
  - `GET /api/reviews/[jobId]/submission`
  - `GET /api/reviews/[jobId]/submission-raw`
  - `POST /api/reviews/[jobId]/publish`
  - `context.publication` on imported review detail

## 5. What is intentionally not implemented yet

- broad PostgreSQL/Prisma runtime adoption beyond the review slice
- committed user identity model in product runtime
- committed memberships or course-scoped authz
- assignment runtime lifecycle
- exam-batch runtime lifecycle
- broader `PublishedResult` / `GradebookEntry` runtime surfaces
- notifications
- analytics snapshots
- export pipelines
- worker migration off the file-backed queue

## 6. Current persistence model

The repo is still primarily file-backed.

Main persisted areas under `HG_DATA_DIR`:

- `jobs/`
- `reviews/`
- `exams/`
- `rubrics/`
- `courses/`
- `uploads/`
- `worker/heartbeat.json`

Current narrow exception on this branch:

- review detail and review list can use Postgres when `DATABASE_URL` is configured
- imported review assets can be served from `StoredAsset` rows with pointwise fallback
- imported review detail can surface current publication state
- imported reviews can publish the current review result into `PublishedResult` and `GradebookEntry`

Runtime code still depends directly on:

- `@hg/local-job-store`
- `@hg/local-course-store`
- app-local file helpers for exams and rubrics

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
- the current runtime now adopts a narrow review and publication slice for imported reviews only,
- broader publication, gradebook, and student-facing lifecycle surfaces are still deferred.

## 8. Next milestone

The approved direction is still PostgreSQL + Prisma, but the next step should stay narrow.

Already implemented seams on this branch:

- `GET /api/reviews/[jobId]`
- `PUT` / `PATCH /api/reviews/[jobId]`
- `GET /api/reviews`
- `GET /api/reviews/[jobId]/submission`
- `GET /api/reviews/[jobId]/submission-raw`
- `POST /api/reviews/[jobId]/publish`

Bridge rule that still matters:

- route params are bridged through `Submission.legacyJobId`

Recommended next scope:

- keep working inside the review area
- do not assume broader DB adoption is already accepted
- do not jump to auth or worker migration next

## 9. Main constraints and do-not-change-yet boundaries

- keep diffs minimal
- do not change worker runtime unless a milestone explicitly includes it
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
- `packages/domain-workflow/src/**`
- `packages/domain-workflow/test/**`
- `packages/shared-schemas/src/**`
- `packages/local-job-store/src/fileJobStore.ts`
- `packages/local-job-store/src/fileReviewStore.ts`
- `packages/local-course-store/src/fileCourseStore.ts`
- `packages/local-course-store/src/fileLectureStore.ts`
- `packages/local-course-store/src/fileCourseRagIndex.ts`
- `packages/postgres-store/**`
- `apps/web/src/app/api/reviews/**`
- `apps/web/src/app/reviews/**`
- `apps/web/src/lib/server/persistence.ts`
- `apps/worker/src/lib/processNextPendingJob.ts`
- `apps/worker/src/scripts/runLoop.ts`

## 12. Git context to share in a new conversation

Current branch:

- `feat/postgres-runtime-slice-1`

Relevant recent commits:

- `8804be7 feat(postgres): add narrow review publication flow`
- `853d1af docs: align branch handoff and architecture with postgres review slices`
- `302b7fe feat(postgres): make review detail independent of legacy jobs api`
- `245e428 feat(postgres): harden review read side and import flow`
- `4b16945 feat(postgres): finalize first prisma review seam and local db bring-up`

Current dirty context:

- none expected after publication slice closure
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

Current runtime shape:
- still primarily file-backed under HG_DATA_DIR
- apps/web + apps/worker still rely mostly on local stores
- @hg/domain-workflow exists and is tested, but broad runtime adoption is still deferred
- current branch has narrow committed Postgres-backed review and publication slices
- imported reviews can publish through `POST /api/reviews/[jobId]/publish`
- imported review detail can expose `context.publication`

Current branch context:
- branch: feat/postgres-runtime-slice-1
- recent commits:
  - 245e428 feat(postgres): harden review read side and import flow
  - 4b16945 feat(postgres): finalize first prisma review seam and local db bring-up
  - c1f09e1 docs(plan): add postgres prisma identity design artifact
  - 7577208 docs(plan): add auth foundation planning artifact
  - 3e052c7 docs(architecture): refresh architecture and add planning artifacts
  - 992a1e8 feat(domain): add workflow foundation package and filesystem adapters
- runtime slice code is already committed; remaining dirty state is docs/plans

Important code to read:
- packages/domain-workflow/src/**
- packages/shared-schemas/src/**
- packages/local-job-store/src/fileJobStore.ts
- packages/local-job-store/src/fileReviewStore.ts
- packages/local-course-store/src/fileCourseStore.ts
- packages/local-course-store/src/fileLectureStore.ts
- packages/local-course-store/src/fileCourseRagIndex.ts
- packages/postgres-store/**
- apps/web/src/app/api/reviews/**
- apps/web/src/app/reviews/**
- apps/web/src/lib/server/persistence.ts

Key architecture boundary:
- runtime is still primarily file-backed outside the narrow review slice
- implemented review seams on this branch:
  - GET /api/reviews/[jobId]
  - PUT/PATCH /api/reviews/[jobId]
  - GET /api/reviews
  - GET /api/reviews/[jobId]/submission*
- Submission.legacyJobId is the bridge from current jobId route params to DB-backed review records
```
