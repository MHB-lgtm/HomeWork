# Homework Grader Architecture

Last updated: 2026-03-27
Status: canonical current-state architecture document
Scope: implemented repo structure, completed milestones, approved next direction, and deferred decisions

## 1. Repo overview

Homework Grader is a pnpm monorepo for a grading system that is still primarily local-first and file-backed, with a narrow Postgres-backed reviews slice now committed on the current branch.

Today the repo contains:

- `apps/web` as the Next.js App Router application for UI pages and HTTP APIs.
- `apps/worker` as the background worker for grading jobs and exam-index generation.
- `packages/shared-schemas` as the current wire/runtime schema package.
- `packages/domain-workflow` as the storage-agnostic domain foundation package.
- `packages/local-job-store` as the active file-backed job, review, and exam-index store.
- `packages/local-course-store` as the active file-backed course, lecture, and RAG store.
- `packages/postgres-store` as the shared PostgreSQL + Prisma persistence package for the current review slice.

The repo is still operationally centered on file-backed grading flows under `HG_DATA_DIR`. The domain foundation milestone is complete, but runtime adoption of that foundation has intentionally not happened yet in the committed baseline.

## 2. Package and app map

### `apps/web`

Owns:

- page routes under `apps/web/src/app/**`,
- API routes under `apps/web/src/app/api/**`,
- exam upload and job creation request boundaries,
- course and lecture management UI/API,
- review browsing and review-editing UI/API.

Current primary page routes:

- `/`
- `/exams`
- `/rubrics`
- `/reviews`
- `/reviews/[jobId]`
- `/courses`
- `/courses/[courseId]`

Current API route groups:

- `apps/web/src/app/api/exams/**`
- `apps/web/src/app/api/jobs/**`
- `apps/web/src/app/api/reviews/**`
- `apps/web/src/app/api/rubrics/**`
- `apps/web/src/app/api/courses/**`
- `apps/web/src/app/api/health/route.ts`

### `apps/worker`

Owns:

- queue consumption from the file-backed job store,
- grading execution in `RUBRIC` and `GENERAL` modes,
- review annotation generation,
- exam-index generation,
- best-effort course study pointer attachment.

Important operational detail:

- `pnpm --filter worker job:run-loop` is the real worker loop.
- `pnpm --filter worker start` only runs `dist/index.js` and should not be treated as the normal queue loop command.

### `packages/shared-schemas`

Owns:

- current Zod schemas and runtime payload contracts for:
  - reviews,
  - course and lecture records,
  - RAG manifests and study pointers,
  - exam index artifacts,
  - general and rubric grading outputs.

This package is still the source of truth for current API/storage-adjacent payload shapes.

### `packages/domain-workflow`

Owns:

- canonical domain entities,
- lifecycle state types,
- storage-agnostic repository interfaces,
- pure workflow rules and services,
- gradebook projection rules,
- publish-boundary contracts.

This package is implemented and tested, but it is still a foundation layer. In the committed project baseline it is not yet the active persistence/runtime layer for `apps/web` or `apps/worker`.

### `packages/local-job-store`

Owns the active file-backed runtime store for:

- job queue records,
- review JSON records,
- exam index JSON artifacts.

It also contains thin domain adapters that expose current review/job assets in `@hg/domain-workflow` shapes without changing runtime behavior.

### `packages/local-course-store`

Owns the active file-backed runtime store for:

- course records,
- lecture records and assets,
- lexical RAG manifests and chunk files.

It also contains thin domain adapters that expose current course/lecture data in `@hg/domain-workflow` shapes without changing runtime behavior.

### `packages/postgres-store`

Owns:

- `prisma/schema.prisma` and migrations,
- Prisma client setup,
- Postgres review-side query helpers,
- repository implementations for the domain foundation,
- import tooling used by the current review slice.

## 3. What is implemented today

### 3.1 Current product/runtime shape

The committed runtime is still exam-first and job-first:

- exams can be uploaded through `apps/web`,
- grading jobs can be created one at a time,
- the worker consumes pending jobs from the local file queue,
- worker output is stored as job results plus review annotations,
- reviews can be listed and edited in the web app,
- course records and lecture uploads exist,
- a lexical course RAG index can be rebuilt and queried.

Current branch addition:

- `GET /api/reviews/[jobId]` is DB-aware when `DATABASE_URL` is configured,
- `PUT` / `PATCH /api/reviews/[jobId]` can persist imported reviews to Postgres,
- `GET /api/reviews` is hybrid and merges DB-backed review fields with file-backed job metadata,
- `import-file-backed` supports `--dry-run`, structured reporting, and rerunnable import into Postgres.

### 3.2 Current persistence model

The primary persistence model is file-backed under `HG_DATA_DIR`.

Key persisted areas:

- `jobs/` for pending, running, done, and failed job records,
- `reviews/` for `ReviewRecord` JSON documents,
- `exams/` for exam packages and `examIndex.json`,
- `rubrics/` for rubric JSON files,
- `courses/` for course metadata, lectures, and RAG files,
- `uploads/` for copied submissions and derived PDFs,
- `worker/heartbeat.json` for worker liveness.

There is now a committed Prisma schema, Postgres persistence package, and narrow review-route runtime use of PostgreSQL on this branch. The rest of the product remains file-backed.

### 3.3 Current runtime boundaries

Committed runtime boundaries are still direct:

- `apps/web` calls file-backed stores and helper libs directly,
- `apps/worker` calls the same file-backed stores directly,
- `packages/domain-workflow` is not yet the main runtime dependency of route handlers or worker flows,
- file path semantics still exist in runtime code, even though the domain package now defines storage-neutral contracts.

### 3.4 Current auth and authorization state

Current committed runtime state is unauthenticated:

- no session middleware,
- no user model,
- no course membership model,
- no course-scoped authorization enforcement.

Any auth, membership, or RBAC behavior described in plan docs is still planned or deferred, not implemented.

## 4. Domain & Workflow Foundation milestone

The `Domain & Workflow Foundation` milestone is complete.

It delivered:

- `packages/domain-workflow`,
- canonical entities for:
  - `Course`
  - `Week`
  - `CourseMaterial`
  - `Assignment`
  - `Submission`
  - `Review`
  - `ReviewVersion`
  - `PublishedResult`
  - `GradebookEntry`
  - `ExamBatch`
  - `Flag`
  - `AuditEvent`
- explicit lifecycle state models,
- repository interfaces that are independent of filesystem, Firestore, and SQL naming,
- pure rules and orchestration services,
- gradebook projection rules,
- thin filesystem adapters in the local-store packages,
- package-local tests for the domain rules.

It intentionally did **not** do any of the following:

- change `apps/web` route behavior,
- change `apps/worker` behavior,
- move persistence away from `HG_DATA_DIR`,
- add users, memberships, or authz,
- add a database or ORM,
- adopt the domain package into runtime request handling.

## 5. Current publish-boundary model

The canonical publish-boundary model now exists in `packages/domain-workflow`.

### `Review`

- the working aggregate for a submission review,
- mutable in workflow terms,
- not the student-safe published truth.

### `ReviewVersion`

- append-only review history,
- used for AI drafts, lecturer edits, and published snapshots,
- preserves the result-envelope lineage.

### `PublishedResult`

- the published truth for a submission outcome,
- tracks historical rows with `effective` vs `superseded`,
- is the source of truth for student-safe published data in the target model.

### `GradebookEntry`

- a projection derived from the effective `PublishedResult`,
- intended as a current read model rather than the historical source of truth.

Important current-state clarification:

- these publication concepts are implemented as domain contracts, rules, services, and tests,
- they are **not yet** persisted or exposed as first-class runtime API objects in the committed baseline.

## 6. What is intentionally still file-backed

The following runtime concerns are still intentionally file-backed today:

- job queue storage,
- review persistence,
- exam-index persistence,
- course persistence,
- lecture persistence,
- course RAG manifests and chunks,
- uploaded submissions and derived files,
- exam upload assets,
- rubric files.

The following runtime surfaces still rely on the file-backed model:

- `apps/web/src/app/api/jobs/**`
- `apps/web/src/app/api/reviews/**`
- `apps/web/src/app/api/exams/**`
- `apps/web/src/app/api/courses/**`
- `apps/worker/src/lib/processNextPendingJob.ts`
- `apps/worker/src/scripts/generateExamIndex.ts`

## 7. Persistence boundaries today

### Current committed boundary

Current persistence is split across:

- `packages/local-job-store`
- `packages/local-course-store`
- `apps/web/src/lib/exams*`
- `apps/web/src/lib/rubrics*`

This means the committed repo still mixes file-backed persistence details into application and worker flows.

### Domain boundary that now exists

`packages/domain-workflow` introduced a clean logical boundary:

- domain contracts and rules live in the domain package,
- translation into current file-backed structures lives in adapter code,
- storage-specific details are meant to stay outside the domain package.

That boundary exists in code, but committed runtime adoption is still deferred.

## 8. Approved direction and current slice status

The approved persistence direction is PostgreSQL + Prisma.

This is now the active persistence design direction for the repo. Older Firebase / Firestore notes are historical context only and should not be treated as the current approved path for the next milestone.

Current design source of truth:

- `plans/postgres-prisma-identity-design.md`

That direction introduced:

- a shared Postgres persistence package,
- Prisma schema and migrations,
- groundwork for identity and course membership tables,
- repository implementations for the domain foundation,
- import tooling from file-backed data,
- a narrow first runtime adoption seam.

## 9. Current DB-backed review seams on this branch

The first approved DB-backed adoption seam was the review API route. It is now implemented narrowly on this branch as:

- `GET /api/reviews/[jobId]`
- `PUT /api/reviews/[jobId]`
- `PATCH /api/reviews/[jobId]`
- `GET /api/reviews`
- `GET /api/reviews/[jobId]/submission`
- `GET /api/reviews/[jobId]/submission-raw`

Approved bridge strategy:

- use `Submission.legacyJobId` as the transitional lookup key from the current route param into DB-backed review data.

Important boundary:

- this slice is intentionally narrow,
- the rest of the product runtime is still file-backed,
- `apps/worker` remains unchanged,
- `apps/web/src/app/api/jobs/**` still remains the legacy file-backed surface for non-review flows.

## 10. Deferred areas and non-goals

The following are intentionally not implemented yet:

- user identity and session runtime,
- course memberships,
- course-scoped authz,
- assignment runtime lifecycle,
- first-class exam-batch runtime lifecycle,
- published-result runtime persistence,
- gradebook runtime surfaces,
- flag persistence and filtering,
- audit-event persistence,
- analytics snapshots,
- notifications,
- export pipelines,
- worker migration away from the file queue.

## 11. Open architectural questions

The main open or deferred architectural decisions are:

1. Identity/session convergence
   - how a future `apps/web` auth layer should integrate with the canonical Postgres user model.

2. Legacy identity resolution
   - how unresolved `studentRef` and `actorRef` values are reported, stored, and later reconciled.

3. Publish concurrency
   - how publication races should be locked and surfaced once PostgreSQL-backed publication is implemented.

4. Gradebook uniqueness and denormalization
   - the exact DB constraints and partial indexes needed for current-effective gradebook rows.

5. Assignment and exam ownership rollout
   - how quickly the product should move from job-oriented runtime flows to canonical `Submission` / `Assignment` / `ExamBatch` ownership.

6. Auth milestone sequencing
   - when the deferred auth foundation should land relative to Postgres persistence and identity-backed data.

## 12. Validation commands that matter today

For the current committed foundation and runtime baseline:

- `pnpm --filter @hg/domain-workflow build`
- `pnpm --filter @hg/domain-workflow test`
- `pnpm --filter @hg/local-job-store build`
- `pnpm --filter @hg/local-course-store build`
- `pnpm --filter web build`
- `pnpm --filter worker build`

On Windows PowerShell setups that block `pnpm.ps1`, use `pnpm.cmd`.
