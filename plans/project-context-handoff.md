# Project Context Handoff

Last updated: 2026-03-31
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
- completed Wave 4B changes that retire live local-store package usage from `apps/web` and `apps/worker` and declare final Postgres cutover for live application state.
- completed Auth M1 changes that add an Auth.js web-session boundary, canonical Postgres-backed session identity, and private-by-default authenticated access in `apps/web`.
- completed Auth M2 changes that add runtime course memberships, course-scoped staff authorization on `/courses` and `/api/courses/**`, and a dev-only demo sign-in flow with real Postgres-backed users and memberships.
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
  - archived file-backed job/review/exam-index persistence retained for rollback/export tooling, archive reads, and debug parity checks
- `packages/local-course-store`
  - archived file-backed course/lecture/RAG persistence retained for archive/debug parity and compatibility-oriented tooling
- `packages/postgres-store`
  - Prisma schema, migrations, import tooling, Postgres review/publication persistence, Wave 1 content stores, completed Wave 2 job/worker runtime stores, completed Wave 3 derived-runtime stores, completed Wave 4A cleanup work, and completed Wave 4B final-cutover cleanup

### Plans and docs

- `ARCHITECTURE.md`
  - canonical current-state architecture document
- `plans/domain-workflow-foundation.md`
  - record of the completed domain-foundation milestone
- `plans/auth-foundation.md`
  - record of the now-implemented auth/session foundation boundary
- `plans/auth-membership-authorization-execution-plan.md`
  - active auth/membership/authorization execution record with M1, M2, and M3A closed
- `plans/postgres-prisma-identity-design.md`
  - approved persistence and identity design direction beyond the original review slice
- `plans/postgres-wave-2-execution-plan.md`
  - current execution record for completed Wave 2
- `plans/postgres-wave-3-execution-plan.md`
  - current execution record for completed Wave 3
- `plans/postgres-wave-4a-execution-plan.md`
  - current execution record for completed Wave 4A
- `plans/postgres-wave-4b-execution-plan.md`
  - current execution record for completed Wave 4B

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
- `Wave 4B`
- `Auth M1`
- `Auth M2`
- `Auth M3A`
- `Auth M3B`
- `Post-M3B Ops Phase`

Current branch context:

- branch: `feat/postgres-runtime-slice-1`
- the Postgres runtime review and publication slices are already committed on this branch
- the current workspace also contains completed Wave 1 exam/rubric/exam-index/course/lecture migration work
- the current workspace also contains completed Wave 2 job/worker/runtime cutover work
- the current workspace also contains completed Wave 3 exam-index/RAG/study-pointer cutover work
- the current workspace also contains completed Wave 4A cleanup of live compatibility writes and broad `HG_DATA_DIR` metadata-read requirements
- the current workspace also contains completed Wave 4B retirement of live local-store package usage and final Postgres cutover cleanup
- the current workspace now also contains completed Auth M1 identity/session foundation work in `apps/web`
- the current workspace now also contains completed Auth M2 course-membership and course-scoped authorization work in `apps/web`
- the current workspace now also contains closed Auth M3A assignment and student-submission foundation work
- the current workspace now also contains closed Auth M3B student published-result and own-data read surfaces
- the current workspace now also contains the closed post-`M3B` ops phase with lifecycle alignment and assignment-first lecturer operational reads
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
- completed Wave 4B runtime cleanup:
  - `apps/worker` no longer imports `@hg/local-job-store` and now uses a worker-local `WorkerJobRecord` type
  - the disabled legacy `job:create` entrypoint has been removed from `apps/worker`
  - `apps/web` no longer carries the unused file-backed `src/lib/exams.ts` or `src/lib/rubrics.ts` helpers
  - `apps/web` and `apps/worker` no longer import `@hg/local-course-store`
  - live runtime application state is now fully Postgres-first, with archived local-store packages retained only for offline/archive workflows
- completed Auth M1 foundation:
  - `apps/web` now has Auth.js-backed session handling
  - canonical session identity resolves through Postgres `User`
  - provider linkage uses `AuthAccount`
- non-auth pages and non-auth APIs are private-by-default for authenticated users, with staff or course-role enforcement applied server-side
  - `/api/health` is now `SUPER_ADMIN`-only
- review publish and new review metadata mutations now attribute session-backed `user:<id>` actors
- `/courses` and `/api/courses/**` now use real course membership data for authorization where the repo model supports it
- `POST /api/courses` is now `SUPER_ADMIN` only
- `GET` / `PUT /api/courses/[courseId]/memberships` now exist as a narrow membership-management API for `SUPER_ADMIN` and active `COURSE_ADMIN`
- development-only Auth.js demo sign-in now exists with one real demo user each for `SUPER_ADMIN`, `COURSE_ADMIN`, `LECTURER`, and `STUDENT`
- the current workspace now also contains closed `M3A` work:
  - `Week`, `Assignment`, and `AssignmentMaterial` runtime persistence
  - `GET` / `POST /api/courses/[courseId]/assignments`
  - `PATCH /api/courses/[courseId]/assignments/[assignmentId]`
  - first student pages at `/assignments` and `/assignments/[assignmentId]`
  - student own-data APIs at `/api/me/assignments/**`
  - immediate DB-backed assignment grading jobs bridged through `Submission.legacyJobId`
  - exam-backed assignment grading that reuses the existing exam pipeline with question decomposition
- the current workspace now also contains closed `M3B` + post-`M3B` ops work:
  - `/results` and `/results/[assignmentId]`
  - `/api/me/results/**`
  - status-only pre-publish student reads plus published score/summary/breakdown reads sourced from effective `PublishedResult` and `GradebookEntry`
  - derived lifecycle/status alignment through staff `operationalStatus` and student `visibleStatus`
  - `/` as the lecturer ops dashboard
  - `/jobs/new` as the new home of the legacy create-job flow
  - `GET /api/staff/dashboard`
  - `GET /api/courses/[courseId]/assignments/[assignmentId]/submissions`
  - `GET /api/courses/[courseId]/assignments/[assignmentId]/submissions/[submissionId]`
  - `/courses/[courseId]/assignments/[assignmentId]`
  - `/courses/[courseId]/assignments/[assignmentId]/submissions/[submissionId]`
  - `/reviews/[jobId]` remaining the edit/publish workspace and publish boundary
  - the first student lifecycle UX refinement slice:
    - `/assignments` as the grouped student action workspace
    - `/assignments/[assignmentId]` as the safe submit/resubmit/detail surface
    - `/results` as the waiting/publication lens for submitted or published rows only
    - a dedicated student assignment read model behind `/api/me/assignments/**` that derives `submittedAt`, `hasSubmission`, `hasPublishedResult`, `canSubmit`, and `canResubmit`
  - the closed route/shell/design-system unification slice:
    - stable public URLs across staff and student surfaces
    - `(staff)` and `(student)` as the official live route groups
    - `WorkspaceShell` as the shared live shell/navigation owner
    - shared `PageHeader` / `StatusBadge` primitives across the main live pages

## 5. What is intentionally not implemented yet

- broader membership-management UI beyond the narrow course-detail panel
- exam-batch runtime lifecycle
- broader `PublishedResult` / `GradebookEntry` runtime surfaces beyond the current student own-data read-side
- broader publication history UI
- notifications
- analytics snapshots
- export pipelines

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
- assignments, assignment materials, and assignment visibility are DB-first in `apps/web`
- student result and gradebook own-data reads are now DB-first in `apps/web`
- jobs, reviews, and worker health are DB-first in completed Wave 2
- exam-index reads, RAG routes, and study pointers are DB-first in completed Wave 3
- assignments now create or update a backing exam artifact and exam index in live runtime
- assignment submissions now create DB-backed grading jobs immediately, inherit the assignment backing exam, and bridge into the existing job/review flow through `Submission.legacyJobId`
- legacy files under `exams/**`, `rubrics/**`, `examIndex.json`, and `courses/**` remain explicit offline compatibility/debug artifacts or archive leftovers only
- leftover `jobs/`, `reviews/`, and `worker/heartbeat.json` files are archive-only and are no longer part of live runtime
- rollback export back into legacy queue files exists only as explicit offline tooling, not as a runtime dual-write path

Runtime code still depends directly on:

- `@hg/postgres-store`
- selected asset-oriented local file reads in web and worker code paths

Archived/offline code remains available in:

- `@hg/local-course-store`
- `@hg/local-job-store`

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
- assignment submissions now feed the current job/review pipeline through DB-backed assignment jobs,
- assignment-triggered jobs now reuse the existing exam pipeline rather than a separate document-only assignment evaluator,
- student own-data result reads now exist, while broader publication history and broader gradebook expansion are still deferred.

## 8. Next milestone

The approved persistence direction is still PostgreSQL + Prisma, and the live persistence cutover is now complete through `W4B`.

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
- `GET` / `POST /api/courses/[courseId]/assignments`
- `PATCH /api/courses/[courseId]/assignments/[assignmentId]`
- `GET /api/me/assignments`
- `GET /api/me/assignments/[assignmentId]`
- `GET /api/me/assignments/[assignmentId]/prompt-raw`
- `POST /api/me/assignments/[assignmentId]/submit`

Bridge rule that still matters:

- route params are bridged through `Submission.legacyJobId`

Recommended next scope:

- move next beyond the closed auth + membership + student-flow arc into broader product hardening and expansion
- keep rollback export offline-only and do not reintroduce live fallback reads
- treat the archived local-store packages as offline/debug code, not as a live runtime path
- keep auth/authz separate from grading-domain logic
- keep worker changes narrow beyond the already-closed `M3A` assignment-job compatibility work unless a later milestone proves a broader change is unavoidable

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
- `plans/postgres-wave-4a-execution-plan.md`
- `plans/postgres-wave-4b-execution-plan.md`
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

- `5ffa1f9 feat(postgres): finalize wave 4b legacy runtime retirement`
- `13fe16b feat(postgres): finalize wave 2 with db-only jobs reviews and health runtime`
- `309b67e feat(postgres): add published lens to reviews list`
- `8804be7 feat(postgres): add narrow review publication flow`
- `853d1af docs: align branch handoff and architecture with postgres review slices`
- `302b7fe feat(postgres): make review detail independent of legacy jobs api`
- `245e428 feat(postgres): harden review read side and import flow`
- `4b16945 feat(postgres): finalize first prisma review seam and local db bring-up`

Current dirty context:

- expect only the intentionally untracked local cutover note unless new work has started
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
- plans/postgres-wave-4b-execution-plan.md

Current runtime shape:
- live runtime is DB-first plus file-backed compatibility/archive artifacts under HG_DATA_DIR
- apps/web is DB-first for review/publication seams, Wave 1 authoring/content surfaces, Wave 2 jobs/health, and Wave 3 exam-index/RAG routes
- apps/web now also owns an Auth.js session boundary with private-by-default access plus course-scoped staff authorization on `/courses` and `/api/courses/**`
- apps/worker claims new jobs from Postgres, writes new review state to Postgres, and reads exam-index/study-pointer derived state from Postgres
- @hg/domain-workflow exists and is tested, but broad runtime adoption is still deferred
- current branch has committed Postgres-backed review and publication slices
- imported reviews can publish through POST /api/reviews/[jobId]/publish
- imported review detail can expose context.publication
- imported review list rows can expose publication summary
- /reviews is the current lecturer-facing published lens for imported reviews
- exams, rubrics, exam-index metadata, courses, and lectures are now DB-first in apps/web
- POST /api/jobs, worker queue/lease lifecycle, worker heartbeat, and review runtime are now DB-first in Wave 2
- GET/PUT /api/exams/[examId]/index, course RAG routes, and worker study pointers are now DB-first in Wave 3
- apps/web and apps/worker no longer import @hg/local-job-store or @hg/local-course-store for live runtime after Wave 4B
- HG_DATA_DIR files under exams/**, rubrics/**, examIndex.json, and courses/** remain compatibility outputs or debug/archive leftovers only
- leftover jobs/, reviews/, and worker/heartbeat.json are archive-only and not part of live runtime
- rollback export to legacy queue files exists only as offline tooling for drills/rollback windows

Current branch context:
- branch: feat/postgres-runtime-slice-1
- recent commits:
  - 5ffa1f9 feat(postgres): finalize wave 4b legacy runtime retirement
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
- runtime is no longer review-only on the Postgres path: Waves 1-4 are active in the workspace and live application state is Postgres-first
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
- implemented Wave 4 cleanup:
  - live compatibility writes removed
  - archived local-store packages no longer imported by apps/web or apps/worker
- implemented Auth M1 and M2 in the workspace:
  - non-auth pages and APIs require authenticated users with server-side authorization
  - `/api/health` requires `SUPER_ADMIN`
  - canonical session identity resolves through Postgres `User`
  - provider linkage uses `AuthAccount`
  - `/courses` and `/api/courses/**` enforce `SUPER_ADMIN` bypass plus active `COURSE_ADMIN` / `LECTURER` membership checks
  - development-only demo sign-in creates or reuses real Postgres-backed demo users, auth accounts, and demo memberships
- publication state is visible in both review detail and review list for imported reviews
- Submission.legacyJobId is the bridge from current jobId route params to DB-backed review records
```
