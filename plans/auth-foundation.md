# Auth Foundation

Status: foundation milestone closed; superseded by `plans/auth-membership-authorization-execution-plan.md`
Last updated: 2026-03-31

## 1. Purpose

Record the web auth/session boundary that is now implemented in `apps/web`, and point future work at the active execution plan.

## 2. Current state

Today the repo has:

- implemented Auth.js session handling in `apps/web`
- canonical session identity backed by Postgres `User`
- provider linkage via `AuthAccount`
- centralized server-side staff/session helpers
- private-by-default pages and APIs
- `SUPER_ADMIN`-only protection on `/api/health`
- implemented course-membership runtime authorization for `/courses` and `/api/courses/**`
- a development-only demo Auth.js provider that creates or reuses real Postgres-backed demo users, a demo course, and demo memberships
- the first student-facing authenticated surface through:
  - `/assignments`
  - `/assignments/[assignmentId]`
  - `/api/me/assignments/**`
- the first student-safe results read-side through:
  - `/results`
  - `/results/[assignmentId]`
  - `/api/me/results`
  - `/api/me/results/[assignmentId]`
- current assignment submission now reuses the existing exam pipeline through exam-backed assignment records rather than a separate document-only grader
- `M3A` closure smoke now confirmed assignment create, student submit, worker processing, review visibility, and publish with canonical student linkage
- the current workspace now also exposes status-only pre-publish student reads plus published summary/score/breakdown reads sourced from effective `PublishedResult` and `GradebookEntry`
- the current auth + membership + student-flow arc is now complete through `M3B`
- the current workspace now also contains the closed post-`M3B` ops phase:
  - derived lifecycle/status alignment through `operationalStatus` and `visibleStatus`
  - `/` as the lecturer ops dashboard
  - `/jobs/new` as the new home of the legacy create-job screen
  - assignment-first staff ops reads at:
    - `GET /api/staff/dashboard`
    - `GET /api/courses/[courseId]/assignments/[assignmentId]/submissions`
    - `GET /api/courses/[courseId]/assignments/[assignmentId]/submissions/[submissionId]`
  - assignment-first staff ops pages that keep `/reviews/[jobId]` as the edit/publish workspace

Still not implemented:

- broader course ownership for exams, rubrics, jobs, and reviews
- the follow-up product scope now moves to student lifecycle UX refinement and route/shell/design-system unification

## 3. Boundary that remains approved

The web app still owns the auth/session boundary.

Required boundary rules remain:

- auth/session code stays separate from grading domain logic
- worker runtime stays out of scope
- server-side protection remains mandatory
- course roles remain modeled through `CourseMembership`, not global grading-domain flags

## 4. Source of truth

The active implementation and next steps now live in:

- `plans/auth-membership-authorization-execution-plan.md`

This older document should now be treated as historical context only.
