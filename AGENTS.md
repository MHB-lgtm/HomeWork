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
  - `/assignments`, `/results`, `/api/me/assignments/**`, and `/api/me/results/**` now expose the current student-facing surfaces for authenticated users with active `STUDENT` membership access
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
- The current workspace also completed `M3A`:
  - `Week`, `Assignment`, and `AssignmentMaterial` are now first-class Postgres runtime entities
  - `GET` / `POST /api/courses/[courseId]/assignments` and `PATCH /api/courses/[courseId]/assignments/[assignmentId]` now support narrow staff assignment authoring under course-scoped authorization
  - `GET /api/me/assignments`, `GET /api/me/assignments/[assignmentId]`, `GET /api/me/assignments/[assignmentId]/prompt-raw`, and `POST /api/me/assignments/[assignmentId]/submit` now support the first student submission flow
  - each assignment now owns a backing exam artifact and auto-indexes that exam-style source for grading
  - assignment submissions are canonically tied to `Submission.studentUserId` and immediately create DB-backed assignment grading jobs bridged through `Submission.legacyJobId`
  - assignment-triggered jobs now run through the existing exam pipeline with exam index and question decomposition, not a separate document-only assignment grader
  - final closure smoke now covers assignment create, student submit, worker processing through the exam pipeline, review visibility, and publish with canonical student linkage
- Exams, rubrics, exam-index state, course metadata, lecture metadata, course RAG state, jobs, worker heartbeat, and review runtime are now DB-authoritative.
- Filesystem artifacts under `HG_DATA_DIR` remain archive-only leftovers, explicit offline compatibility/debug artifacts, rollback tooling, and asset storage only.
- Wave 2 also includes offline rollback tooling via `pnpm --filter @hg/postgres-store rollback:export-jobs`, which exports `PENDING` / `RUNNING` DB jobs back into the legacy queue shape only for rollback drills.
- `@hg/domain-workflow` exists and is tested, but broad runtime adoption is still deferred.
- Keep auth/session concerns separate from grading domain logic.
- Course-scoped authorization is now implemented for `/courses` and `/api/courses/**`, while non-course-owned staff surfaces such as exams, jobs, reviews, and rubrics remain coarse staff-only until ownership is tightened in a later milestone.
- Development-only demo sign-in now exists in `apps/web` through an Auth.js credentials provider that seeds or reuses real Postgres-backed demo users, memberships, and sessions. It is disabled outside development.
- The current workspace now also completed `M3B`:
  - `/results` and `/results/[assignmentId]` now provide the first student gradebook and published-result pages
  - `GET /api/me/results` and `GET /api/me/results/[assignmentId]` now expose student-safe own-data reads sourced from `PublishedResult` and `GradebookEntry`
  - pre-publish student reads remain status-only, while published reads expose summary, score, and published breakdown without staff review metadata
  - the current auth + membership + student-flow arc is now complete through `M3B`
- The current workspace now also completed the post-`M3B` ops phase:
  - derived lifecycle/status alignment now exists through staff-facing `operationalStatus` and student-facing `visibleStatus`
  - `/` now acts as the lecturer ops dashboard, while `/jobs/new` is the new home of the legacy create-job flow
  - `GET /api/staff/dashboard`, `GET /api/courses/[courseId]/assignments/[assignmentId]/submissions`, and `GET /api/courses/[courseId]/assignments/[assignmentId]/submissions/[submissionId]` now expose assignment-first operational reads
  - `/courses/[courseId]/assignments/[assignmentId]` and `/courses/[courseId]/assignments/[assignmentId]/submissions/[submissionId]` now provide staff ops read surfaces, while `/reviews/[jobId]` remains the edit/publish workspace
  - staff ops reads remain course-scoped for `SUPER_ADMIN` or active `COURSE_ADMIN` / `LECTURER` membership only
- The current workspace now also includes the first student lifecycle UX refinement slice:
  - `/assignments` now acts as the grouped student action workspace for `OPEN`, `SUBMITTED`, and `PUBLISHED` assignment states
  - `/assignments/[assignmentId]` now renders safe submit, waiting, published, and resubmit states without exposing staff review internals
  - `/results` now acts as the student waiting/publication lens and lists only assignments with a latest submission or published result
  - `/api/me/assignments/**` now uses a dedicated student assignment read model that derives `submittedAt`, `hasSubmission`, `hasPublishedResult`, `canSubmit`, and `canResubmit`
- The current workspace now also completed section 4 route/shell/design-system unification:
  - public URLs remain stable across staff and student surfaces
  - `(staff)` and `(student)` are now the official live route-group boundaries for role-owned pages
  - `WorkspaceShell` now owns the live shell and navigation behavior for both staff and student routes
  - `AccountMenu` is now limited to account/session actions, while role navigation is centralized in shell config
  - shared `PageHeader` and `StatusBadge` primitives now drive the main live page headers and status presentation
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
