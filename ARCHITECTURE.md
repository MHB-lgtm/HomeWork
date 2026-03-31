# Homework Grader Architecture

Last updated: 2026-03-31
Status: canonical current-state architecture document
Scope: implemented repo structure, completed milestones, approved next direction, and deferred decisions

## 1. Repo overview

Homework Grader is a pnpm monorepo for a grading system that is now DB-first for live application state, while local files under `HG_DATA_DIR` remain for asset bytes and explicit offline/archive tooling, with:

- a committed Postgres-backed review and publication slice on the current branch, including a lecturer-facing publication lens inside `/reviews`,
- a completed Wave 1 migration that makes exam metadata, rubric storage, exam-index metadata, course metadata, and lecture metadata DB-first in `apps/web` while preserving filesystem compatibility exports for unchanged consumers,
- a completed Wave 2 migration that makes jobs, reviews, and worker health DB-first in live runtime while leaving rollback export and archive-only legacy files outside the live request path,
- a completed Wave 3 migration that makes live exam-index reads, course RAG, and study-pointer retrieval DB-first while leaving filesystem artifacts as compatibility or debug-only leftovers,
- a completed Wave 4A cleanup that removes live compatibility writes and narrows `HG_DATA_DIR` to asset-byte paths plus explicit offline/archive tooling,
- a completed Wave 4B cleanup that removes live app/runtime imports of the archived local-store packages and declares final Postgres cutover for live application state.

Today the repo contains:

- `apps/web` as the Next.js App Router application for UI pages and HTTP APIs.
- `apps/worker` as the background worker for grading jobs and exam-index generation.
- `packages/shared-schemas` as the current wire/runtime schema package.
- `packages/domain-workflow` as the storage-agnostic domain foundation package.
- `packages/local-job-store` as the archived file-backed job, review, and exam-index store retained for rollback/export tooling, archive reads, and debug parity checks.
- `packages/local-course-store` as the archived file-backed course, lecture, and RAG store retained for archive/debug parity and compatibility-oriented tooling.
- `packages/postgres-store` as the shared PostgreSQL + Prisma persistence package for the review/publication slice, completed Wave 1 authoring/content slice, completed Wave 2 job/worker slice, completed Wave 3 derived-runtime slice, completed Wave 4A cleanup work, and completed Wave 4B legacy runtime retirement.

The repo is no longer review-only or hybrid-only on the Postgres path: Waves 1-4 now make exams, rubrics, exam-index state, courses, lectures, course RAG, jobs, reviews, and worker heartbeat DB-first in live runtime, and completed Wave 4B removes the last live app/runtime imports of archived local-store code. The domain foundation milestone is complete, but broad runtime adoption of that foundation is still intentionally incomplete.

## 2. Package and app map

### `apps/web`

Owns:

- page routes under `apps/web/src/app/**`,
- API routes under `apps/web/src/app/api/**`,
- the Auth.js login/session boundary,
- exam upload and job creation request boundaries,
- course and lecture management UI/API,
- review browsing and review-editing UI/API.

Current primary page routes:

- `/`
- `/jobs/new`
- `/exams`
- `/rubrics`
- `/reviews`
- `/reviews/[jobId]`
- `/courses`
- `/courses/[courseId]`
- `/courses/[courseId]/assignments/[assignmentId]`
- `/courses/[courseId]/assignments/[assignmentId]/submissions/[submissionId]`
- `/assignments`
- `/assignments/[assignmentId]`
- `/results`
- `/results/[assignmentId]`

Current API route groups:

- `apps/web/src/app/api/auth/**`
- `apps/web/src/app/api/staff/**`
- `apps/web/src/app/api/exams/**`
- `apps/web/src/app/api/jobs/**`
- `apps/web/src/app/api/me/**`
- `apps/web/src/app/api/reviews/**`
- `apps/web/src/app/api/rubrics/**`
- `apps/web/src/app/api/courses/**`
- `apps/web/src/app/api/health/route.ts`

### `apps/worker`

Owns:

- queue consumption from the DB-backed `GradingJob` runtime,
- grading execution in `RUBRIC` and `GENERAL` modes,
- review annotation generation,
- exam-index generation backed by Postgres,
- best-effort course study pointer attachment backed by Postgres lexical RAG.

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

Owns the archived file-backed store for:

- job queue records,
- review JSON records,
- exam index JSON artifacts.

It also contains thin domain adapters and rollback-compatible file shapes used by offline rollback tooling, archive reads, and debug parity checks. It is no longer a live runtime dependency of `apps/web` or `apps/worker`.

### `packages/local-course-store`

Owns the archived file-backed store for:

- compatibility-exported course and lecture records,
- lecture assets,
- legacy lexical RAG manifests and chunk files retained only for archive/debug parity.

It also contains thin domain adapters that expose current course/lecture data in `@hg/domain-workflow` shapes without changing runtime behavior. It is no longer a live runtime dependency of `apps/web` or `apps/worker`.

### `packages/postgres-store`

Owns:

- `prisma/schema.prisma` and migrations,
- Prisma client setup,
- Postgres review-side query helpers,
- repository implementations for the domain foundation,
- import tooling used by the current review and publication slice,
- runtime stores and compatibility materializers for the current Wave 1 exams/rubrics/index and courses/lectures slices,
- runtime stores for `GradingJob` and `WorkerHeartbeat`,
- DB-backed review/runtime query helpers used by the completed Wave 2 cutover,
- DB-backed lexical RAG storage and query helpers used by the completed Wave 3 cutover,
- offline compatibility materializers and rollback helpers retained after the completed Wave 4B cutover.

## 3. What is implemented today

### 3.1 Current product/runtime shape

The committed runtime is now assignment-first for staff operations while remaining exam-backed and review/job-backed underneath:

- exams can be uploaded through `apps/web`,
- grading jobs can be created one at a time,
- the worker now consumes pending jobs from Postgres for new runtime traffic,
- worker output for new jobs is stored in Postgres as job state plus review versions,
- reviews can be listed and edited in the web app,
- course records and lecture uploads exist,
- a lexical course RAG index can be rebuilt and queried.

Current branch review/publication addition:

- `GET /api/reviews/[jobId]` is DB-aware when `DATABASE_URL` is configured,
- `PUT` / `PATCH /api/reviews/[jobId]` can persist imported reviews to Postgres,
- `GET /api/reviews` is DB-first and lists DB runtime jobs plus imported legacy DB reviews,
- `GET /api/reviews/[jobId]/submission` and `/submission-raw` can serve imported assets through review-centric APIs,
- `POST /api/reviews/[jobId]/publish` can publish imported review results into `PublishedResult` / `GradebookEntry`,
- review detail can surface current publication state and expose a narrow lecturer-facing publish / republish flow,
- `/reviews` now acts as a narrow lecturer-facing published lens for imported reviews,
- `import-file-backed` supports `--dry-run`, structured reporting, and rerunnable import into Postgres.

Current Wave 1 addition:

- `GET` / `POST /api/exams` are DB-first,
- `GET /api/exams/[examId]` is DB-first,
- `GET` / `PUT /api/exams/[examId]/index` are DB-first for exam-index metadata,
- `GET` / `POST /api/rubrics` are DB-first,
- `GET /api/rubrics/[examId]/[questionId]` is DB-first,
- `GET` / `POST /api/courses` are DB-first,
- `GET /api/courses/[courseId]` is DB-first,
- `GET` / `POST /api/courses/[courseId]/lectures` are DB-first,
- exam metadata, rubric data, and exam-index metadata are now imported into Postgres and can be materialized back into legacy filesystem artifacts only through explicit offline/import tooling,
- course metadata and lecture metadata are now authored in Postgres and may be materialized back into legacy filesystem artifacts only through explicit offline/import tooling,
- `apps/worker/src/scripts/generateExamIndex.ts` now saves exam-index metadata only to Postgres in normal runtime.

Current Wave 2 addition:

- `POST /api/jobs` is DB-first,
- `GET /api/jobs/[id]` is DB-only,
- `GET /api/jobs/[id]/submission` and `/submission-raw` are DB-only,
- `GET /api/health` is DB-only from `WorkerHeartbeat`,
- `GET /api/reviews` lists only DB runtime jobs plus imported legacy DB reviews,
- `GET /api/reviews/[jobId]` returns DB-backed empty review context for pending runtime jobs with no saved version yet,
- `PUT` / `PATCH /api/reviews/[jobId]` and `POST /api/reviews/[jobId]/publish` now operate on new DB-authored jobs as well as imported legacy reviews through the `Submission.legacyJobId` bridge,
- `apps/worker/src/scripts/runLoop.ts` and `runOnce.ts` now claim from Postgres and renew explicit leases,
- the legacy `apps/worker/src/scripts/createJob.ts` entrypoint was removed after the Wave 2 cutover,
- live runtime no longer writes or reads `jobs/*.json`, `reviews/*.json`, or `worker/heartbeat.json`,
- `@hg/postgres-store` now includes offline rollback export tooling that can materialize `PENDING` / `RUNNING` DB jobs back into the legacy queue shape for rollback drills only.

Current Wave 3 addition:

- `GET` / `PUT /api/exams/[examId]/index` are DB-only in live runtime,
- `apps/worker/src/core/loadExamIndex.ts` reads `ExamIndex.payloadJson` from Postgres,
- `apps/worker/src/core/listExamQuestionIds.ts` derives ordered question ids from the DB-backed exam index payload,
- `GET /api/courses/[courseId]/rag/manifest` is DB-only,
- `POST /api/courses/[courseId]/rag/rebuild` writes lexical RAG state to Postgres,
- `POST /api/courses/[courseId]/rag/query` is DB-only,
- `POST /api/courses/[courseId]/rag/suggest` is DB-only,
- `apps/worker/src/core/attachStudyPointers.ts` uses the same Postgres-backed lexical retrieval path,
- `CourseRagIndex` and `CourseRagChunk` are now the DB-authoritative lexical RAG runtime state.

Current Wave 4A addition:

- live `POST /api/exams` no longer writes `exams/<examId>/exam.json`,
- live `POST /api/rubrics` no longer writes `rubrics/<examId>/*.json`,
- live `POST /api/courses` no longer writes `courses/<courseId>/course.json`,
- live `POST /api/courses/[courseId]/lectures` no longer writes `courses/<courseId>/lectures/<lectureId>/lecture.json`,
- `GET /api/exams` and `GET /api/exams/[examId]` are DB-backed metadata reads with no `HG_DATA_DIR` requirement,
- `GET /api/rubrics`, `GET /api/rubrics/[examId]/[questionId]`, and `POST /api/rubrics` no longer require `HG_DATA_DIR`,
- `POST /api/courses` no longer requires `HG_DATA_DIR`,
- `import-file-backed` emits compatibility files only when `--emit-compat-files` is passed.

Current Wave 4B addition:

- `apps/worker` no longer imports `@hg/local-job-store` and now uses a worker-local `WorkerJobRecord` type,
- the disabled legacy `apps/worker/src/scripts/createJob.ts` entrypoint has been removed,
- `apps/web` no longer carries the unused file-backed `src/lib/exams.ts` or `src/lib/rubrics.ts` helpers,
- `apps/web` and `apps/worker` no longer import `@hg/local-course-store`,
- live runtime application state can now be described as fully Postgres-first, with archived local-store packages retained only for offline/archive workflows.

Current Auth M1 addition:

- `apps/web` now owns an Auth.js-backed session boundary,
- non-auth pages and non-auth API routes are private-by-default for authenticated users, with staff or course-role enforcement applied server-side,
- `GET /api/health` is now restricted to `SUPER_ADMIN`,
- canonical session identity now resolves through Postgres `User`,
- provider linkage now uses `AuthAccount`,
- coarse staff access is currently derived from `SUPER_ADMIN` or any active `COURSE_ADMIN` / `LECTURER` membership,
- the M1 foundation is now extended by the M2 course-scoped authorization work described below.

Current Auth M2 addition:

- `CourseMembership` is now real runtime authorization data, not schema-only groundwork,
- `apps/web` now uses a dedicated Postgres membership store for course access lookup, staff-course listing, membership listing, and idempotent membership upsert by email,
- Google OAuth remains intact, but sign-in now allows any provisioned `ACTIVE` user instead of only coarse staff users,
- `STUDENT` users can now authenticate if provisioned, but they still have no staff-page or staff-API access,
- development-only demo login now exists through a dev-only Auth.js credentials provider that seeds or reuses real Postgres-backed demo users, a demo course, and demo course memberships,
- the dev demo flow exposes one real demo identity each for:
  - `SUPER_ADMIN`
  - `COURSE_ADMIN`
  - `LECTURER`
  - `STUDENT`
- `/courses` and `/api/courses/**` are now course-scoped:
  - `SUPER_ADMIN` can access all courses and create new courses,
  - active `COURSE_ADMIN` / `LECTURER` users can access only their own course-owned staff surfaces,
  - `STUDENT` users are blocked from current staff-only course surfaces,
- `GET` / `PUT /api/courses/[courseId]/memberships` now exist as a narrow membership-management API for `SUPER_ADMIN` and active `COURSE_ADMIN` only,
- non-course-owned staff surfaces such as exams, rubrics, jobs, and reviews remain coarse staff-only until ownership is tightened in a later milestone.

Current Auth M3A addition:

- `Week`, `Assignment`, and `AssignmentMaterial` are now first-class Postgres runtime entities,
- assignments are now exam-backed workflow containers:
  - staff authoring uploads one assignment source PDF,
  - each assignment links to a backing `Exam`,
  - backing exam index generation is triggered on create and on source replacement,
- first student pages now exist at:
  - `/assignments`
  - `/assignments/[assignmentId]`
- first student own-data APIs now exist at:
  - `GET /api/me/assignments`
  - `GET /api/me/assignments/[assignmentId]`
  - `GET /api/me/assignments/[assignmentId]/prompt-raw`
  - `POST /api/me/assignments/[assignmentId]/submit`
- student submissions are canonically tied to `Submission.studentUserId`,
- assignment-triggered jobs still bridge through `Submission.legacyJobId`,
- assignment-triggered jobs now run through the existing exam pipeline with exam index and question decomposition instead of a separate document-only assignment grader.
- manual closure smoke now confirms:
  - course admin can create a fresh assignment with a backing exam and indexed question set
  - demo student can see that assignment and submit a solution
  - worker processes the resulting job through the existing exam pipeline
  - staff can review and publish the result while keeping canonical `PublishedResult.studentUserId` and `GradebookEntry.studentUserId` linkage

Current Auth M3B addition:

- first student result pages now exist at:
  - `/results`
  - `/results/[assignmentId]`
- first student result own-data APIs now exist at:
  - `GET /api/me/results`
  - `GET /api/me/results/[assignmentId]`
- student result reads are assignment-centric and derive from active `STUDENT` membership visibility plus canonical `Submission.studentUserId`
- pre-publish student reads are status-only and do not expose review drafts or staff metadata
- published student reads now expose score, summary, and published breakdown data sourced from effective `PublishedResult` and `GradebookEntry`

Current post-M3B ops phase addition:

- derived lifecycle/status alignment now exists:
  - staff reads expose `operationalStatus`
  - student assignment/result reads expose `visibleStatus`
- `/` now acts as the lecturer ops dashboard
- `/jobs/new` is now the home of the legacy create-job workflow
- new assignment-first staff operational APIs now exist:
  - `GET /api/staff/dashboard`
  - `GET /api/courses/[courseId]/assignments/[assignmentId]/submissions`
  - `GET /api/courses/[courseId]/assignments/[assignmentId]/submissions/[submissionId]`
- new assignment-first staff operational pages now exist:
  - `/courses/[courseId]/assignments/[assignmentId]`
  - `/courses/[courseId]/assignments/[assignmentId]/submissions/[submissionId]`
- staff operational reads now treat `Assignment` as the primary unit and expose only the latest non-`SUPERSEDED` submission per student+assignment
- `/reviews` and `/reviews/[jobId]` remain the edit/publish workspace and publish boundary
- current closure smoke now confirms:
  - `Demo Course Admin` can load `/` as the lecturer dashboard
  - a fresh assignment can be opened through `Open Ops`
  - the staff ops surfaces show `SUBMITTED`, `PROCESSING`, `READY_FOR_REVIEW`, and `PUBLISHED`
  - publish through `/reviews/[jobId]` updates both the dashboard and the assignment ops surfaces

### 3.2 Current persistence model

The primary persistence model is now DB-first for live application state. Filesystem usage remains for asset bytes, archive-only legacy files, rollback tooling, and explicit offline compatibility/debug materialization under `HG_DATA_DIR`.

Key persisted areas:

- `jobs/` for archive-only pre-cutover legacy job records,
- `reviews/` for archive-only pre-cutover legacy `ReviewRecord` JSON documents,
- `exams/` for exam packages and archive/debug `examIndex.json`,
- `rubrics/` for archive/debug rubric JSON files,
- `courses/` for archive/debug course and lecture metadata plus archive/debug RAG files,
- `uploads/` for copied submissions and derived PDFs,
- `worker/heartbeat.json` as an archive-only legacy artifact.

There is now a committed Prisma schema, Postgres persistence package, and active PostgreSQL runtime use for reviews/publication, Wave 1 authoring surfaces, completed Wave 2 job/worker runtime, completed Wave 3 derived-runtime systems, and completed Waves 4A-4B cleanup. The remaining file-backed areas are archive-only legacy artifacts, explicit offline compatibility/debug tooling, rollback tooling, and asset bytes.

### 3.3 Current runtime boundaries

Committed runtime boundaries are now:

- `apps/web` uses Postgres runtime stores for reviews, authoring/content surfaces, jobs/health, exam-index reads, and course RAG reads,
- `apps/worker` uses Postgres runtime stores for queue claims, leases, heartbeat, exam-index reads, and study-pointer retrieval,
- archived local-store packages remain in-repo but are no longer part of live app/runtime imports,
- `packages/domain-workflow` is not yet the main runtime dependency of route handlers or worker flows,
- file path semantics still exist in runtime code for asset bytes and debug/archive tooling, even though the domain package now defines storage-neutral contracts.

### 3.4 Current auth and authorization state

Current committed runtime state now has a web-only auth/session and course-membership foundation:

- `apps/web` owns the Auth.js login/session boundary,
- session identity is resolved against canonical Postgres `User` rows,
- provider linkage is stored in `AuthAccount`,
- `IdentityAlias` remains available for legacy and institutional identity mapping,
- sign-in now allows any provisioned `ACTIVE` user,
- non-auth pages and non-auth API routes are private-by-default,
- `SUPER_ADMIN` remains the only global elevated role,
- active `COURSE_ADMIN` / `LECTURER` memberships grant staff access in their own courses,
- `/courses` and `/api/courses/**` now enforce course-scoped staff authorization,
- `STUDENT` users can authenticate if provisioned but remain blocked from current staff surfaces,
- development-only demo sign-in exists through Auth.js and seeds or reuses real Postgres users, auth accounts, and demo memberships,
- worker runtime remains out of scope and does not depend on web session/auth.

Still not implemented:

- broad membership-management UI beyond the current narrow course-detail panel,
- course ownership for exams, rubrics, jobs, and reviews.

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
- DB-backed publication is now persisted and exposed through review-centric APIs for imported reviews and new runtime jobs,
- current effective publication state is now visible in both review detail and review list surfaces for imported reviews and new runtime jobs,
- broader publication and gradebook surfaces are still not first-class runtime APIs in the product.

## 6. What is intentionally still file-backed

The following runtime concerns are still intentionally file-backed today:

- uploaded submissions and derived files,
- archive-only pre-cutover `jobs/` and `reviews/` records,
- archive-only `worker/heartbeat.json`,
- explicit offline compatibility/debug exam/course/lecture artifacts,
- archive/debug `examIndex.json`, `manifest.json`, and `chunks.jsonl` leftovers when present.

The following file-backed tooling still exists, but only as explicit offline rollback or compatibility tooling:

- `pnpm --filter @hg/postgres-store rollback:export-jobs` for exporting `PENDING` / `RUNNING` DB jobs into the legacy queue shape during a rollback drill,
- DB-to-filesystem compatibility materializers for exams, rubrics, courses, lectures, and exam-index metadata.

The following artifacts still exist on disk in the current working tree, but now act as compatibility outputs rather than peer sources of truth:

- `exams/<examId>/exam.json`
- `exams/<examId>/assets/*`
- `rubrics/<examId>/*.json`
- `exams/<examId>/examIndex.json`
- `courses/<courseId>/course.json`
- `courses/<courseId>/lectures/<lectureId>/lecture.json`
- `courses/<courseId>/lectures/<lectureId>/assets/*`

The following runtime surfaces still rely on file-backed details:

- none for authoritative application state

The following code paths may still touch filesystem state, but not as authoritative JSON runtime sources:

- asset-streaming web routes such as submission/raw asset handlers
- `apps/worker/src/core/*` paths that read submission or exam asset bytes from stored local files

## 7. Persistence boundaries today

### Current committed boundary

Current authoritative live persistence is centered on:

- `packages/postgres-store`

Supporting non-authoritative filesystem concerns still exist in:

- archived `packages/local-course-store`
- archived `packages/local-job-store`
- asset-byte handling inside selected web and worker code paths

This means the committed repo still contains file-backed compatibility, rollback, archive, and asset-storage details, but no longer uses them as authoritative live runtime persistence.

### Domain boundary that now exists

`packages/domain-workflow` introduced a clean logical boundary:

- domain contracts and rules live in the domain package,
- translation into current file-backed structures lives in adapter code,
- storage-specific details are meant to stay outside the domain package.

That boundary exists in code, but committed runtime adoption is still deferred.

## 8. Approved direction and current slice status

The approved persistence direction is PostgreSQL + Prisma.

This is now the active persistence design direction for the repo. Older Firebase / Firestore notes are historical context only and should not be treated as the current approved path for the next milestone.

Persistence cutover for live application state is now complete through Wave 4B. Auth M1, M2, M3A, and M3B are now closed. The current auth + membership + student-flow arc is now complete through the student own-data read side.

Current design source of truth:

- `plans/postgres-prisma-identity-design.md`

That direction introduced:

- a shared Postgres persistence package,
- Prisma schema and migrations,
- groundwork for identity and course membership tables,
- repository implementations for the domain foundation,
- import tooling from file-backed data,
- a narrow first runtime adoption seam, later extended on this branch to the review/publication slice, completed Wave 1 authoring/content cutover, completed Wave 2 job/review/health cutover, completed Wave 3 derived-runtime cutover, and completed Wave 4 cleanup/final cutover declaration.

## 9. Current DB-backed review and runtime seams on this branch

The first approved DB-backed adoption seam was the review API route. The current workspace has extended that into Wave 1 authoring/content cutover and completed Wave 2 job/review/health cutover. Active DB-backed seams now include:

- `GET /api/reviews/[jobId]`
- `PUT /api/reviews/[jobId]`
- `PATCH /api/reviews/[jobId]`
- `GET /api/reviews`
- `GET /api/reviews/[jobId]/submission`
- `GET /api/reviews/[jobId]/submission-raw`
- `POST /api/reviews/[jobId]/publish`
- `POST /api/jobs`
- `GET /api/jobs/[id]`
- `GET /api/jobs/[id]/submission`
- `GET /api/jobs/[id]/submission-raw`
- `GET /api/health`
- `GET /api/exams/[examId]/index`
- `PUT /api/exams/[examId]/index`
- `GET /api/courses/[courseId]/rag/manifest`
- `POST /api/courses/[courseId]/rag/rebuild`
- `POST /api/courses/[courseId]/rag/query`
- `POST /api/courses/[courseId]/rag/suggest`
- `GET /api/courses/[courseId]/assignments`
- `POST /api/courses/[courseId]/assignments`
- `PATCH /api/courses/[courseId]/assignments/[assignmentId]`
- `GET /api/me/assignments`
- `GET /api/me/assignments/[assignmentId]`
- `GET /api/me/assignments/[assignmentId]/prompt-raw`
- `POST /api/me/assignments/[assignmentId]/submit`
- `apps/worker/src/core/loadExamIndex.ts`
- `apps/worker/src/core/listExamQuestionIds.ts`
- `apps/worker/src/core/attachStudyPointers.ts`
- `apps/worker/src/scripts/generateExamIndex.ts`
- no live `apps/web` or `apps/worker` imports of `@hg/local-job-store` or `@hg/local-course-store`

Approved bridge strategy:

- use `Submission.legacyJobId` as the transitional lookup key from the current route param into DB-backed review data.

Important boundary:

- publication is lecturer-facing and review-centric only,
- `/reviews` is the current lecturer-facing read surface for publication summary only,
- `apps/worker` now claims jobs from Postgres and writes review state to Postgres,
- assignment submissions now create DB-backed grading jobs immediately and bridge back to the existing review/job surfaces through `Submission.legacyJobId`,
- assignment authoring now creates or updates a backing exam artifact and exam index behind the scenes,
- assignment-triggered jobs reuse the existing exam pipeline rather than a separate assignment-only evaluator,
- `apps/web/src/app/api/jobs/**`, `apps/web/src/app/api/reviews/**`, `apps/web/src/app/api/health/route.ts`, `apps/web/src/app/api/exams/[examId]/index/route.ts`, and `apps/web/src/app/api/courses/[courseId]/rag/**` are DB-only in live runtime,
- file-only leftover `jobs/`, `reviews/`, and `worker/heartbeat.json` artifacts are archive-only,
- file-only leftover `examIndex.json`, `manifest.json`, and `chunks.jsonl` artifacts are compatibility/debug leftovers only and are not part of live runtime.

## 10. Deferred areas and non-goals

The following are intentionally not implemented yet:

- broader membership-management runtime surfaces,
- first-class exam-batch runtime lifecycle,
- broader published-result runtime surfaces beyond the current student own-data read-side,
- broader gradebook runtime surfaces beyond the current student own-data read-side,
- broader publication history/timeline UI,
- flag persistence and filtering,
- audit-event persistence,
- analytics snapshots,
- notifications,
- export pipelines,
- broader student-safe own-data access beyond the current assignment submission slice,
- broader post-cutover product work.

## 11. Open architectural questions

The main open or deferred architectural decisions are:

1. Identity/session convergence
   - how a future `apps/web` auth layer should integrate with the canonical Postgres user model.

2. Legacy identity resolution
   - how unresolved `studentRef` and `actorRef` values are reported, stored, and later reconciled.

3. Publish concurrency hardening
   - how publication races should be locked and surfaced for broader concurrent rollout beyond the current narrow review publish flow.

4. Gradebook uniqueness and denormalization
   - the exact DB constraints and partial indexes needed for current-effective gradebook rows.

5. Assignment and exam ownership rollout
   - how quickly the product should extend the current assignment submission slice into fuller canonical `Submission` / `Assignment` / `ExamBatch` ownership across the rest of the product.

6. Post-M3B product expansion
   - how the repo should prioritize the next two already-identified follow-up areas:
     - student lifecycle UX refinement
     - route/shell/design-system unification

## 12. Validation commands that matter today

For the current committed foundation and runtime baseline:

- `pnpm --filter @hg/postgres-store build`
- `pnpm --filter @hg/postgres-store test`
- `pnpm --filter @hg/postgres-store prisma:validate`
- `pnpm --filter @hg/postgres-store prisma:generate`
- `pnpm --filter @hg/domain-workflow build`
- `pnpm --filter @hg/domain-workflow test`
- `pnpm --filter web build`
- `pnpm --filter worker build`

Archive-only package checks matter only when explicitly editing those packages:

- `pnpm --filter @hg/local-job-store build`
- `pnpm --filter @hg/local-course-store build`

On Windows PowerShell setups that block `pnpm.ps1`, use `pnpm.cmd`.
