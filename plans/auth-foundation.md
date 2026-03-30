# Auth Foundation

Status: foundation milestone closed; superseded by `plans/auth-membership-authorization-execution-plan.md`
Last updated: 2026-03-30

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
- current assignment submission now reuses the existing exam pipeline through exam-backed assignment records rather than a separate document-only grader
- `M3A` closure smoke now confirmed assignment create, student submit, worker processing, review visibility, and publish with canonical student linkage

Still not implemented:

- published student results and gradebook own-data read-side
- broader course ownership for exams, rubrics, jobs, and reviews

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
