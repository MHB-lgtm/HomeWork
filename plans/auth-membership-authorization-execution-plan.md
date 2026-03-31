# Auth, Membership, and Authorization Execution Plan

Status: current-state execution record with M1-M3B and the post-M3B ops phase closed
Last updated: 2026-03-31

## 1. Executive Summary

The next post-cutover architecture milestone is auth, memberships, and authorization in `apps/web`.

The approved direction remains:

- canonical identity is `User`
- session/auth lives only in `apps/web`
- auth stays separate from grading-domain logic
- authorization is private-by-default
- global roles stay minimal
- course access is modeled through `CourseMembership`
- worker stays out of scope

Current status:

- `M1` is closed
- `M2` is now closed
- `M3` is now split into `M3A` and `M3B`
- `M3A` is now closed
- `M3B` is now closed and adds student-safe published-result and gradebook reads
- the post-`M3B` ops phase is now closed and adds lifecycle alignment plus assignment-first lecturer operational reads

## 2. Current Repo Truth

- `apps/web` now has an implemented Auth.js session boundary.
- Login/session now allows any provisioned `ACTIVE` user.
- All current non-auth pages and APIs are private-by-default.
- `GET /api/health` is now `SUPER_ADMIN` only.
- Prisma schema now includes:
  - `User`
  - `AuthAccount`
  - `IdentityAlias`
  - `CourseMembership`
- `packages/postgres-store` now includes a user-auth query layer used by `apps/web`.
- Current staff access is derived from:
  - `SUPER_ADMIN`
  - or any active `COURSE_ADMIN` / `LECTURER` membership in the relevant course
- `/courses` and `/api/courses/**` now enforce course-scoped authorization where the repo model supports it.
- A development-only demo sign-in path now exists and seeds or reuses real Postgres-backed demo users, a demo course, and demo memberships through Auth.js.
- The current workspace now includes a first student-facing surface:
  - `/assignments`
  - `/assignments/[assignmentId]`
  - `GET /api/me/assignments`
  - `GET /api/me/assignments/[assignmentId]`
  - `GET /api/me/assignments/[assignmentId]/prompt-raw`
  - `POST /api/me/assignments/[assignmentId]/submit`
- Assignment runtime now exists through `Week`, `Assignment`, and `AssignmentMaterial`.
- Assignments are now exam-backed workflow records:
  - staff upload an assignment source PDF
  - each assignment links to a backing exam artifact
  - backing exam index generation is triggered during authoring
- Student submissions are now canonically tied to `Submission.studentUserId` and create immediate DB-backed assignment grading jobs bridged through `Submission.legacyJobId`.
- Assignment-triggered jobs now reuse the existing exam pipeline with exam index and question decomposition rather than a separate document-only assignment grader.
- The current workspace now also includes student result read-side surfaces:
  - `/results`
  - `/results/[assignmentId]`
  - `GET /api/me/results`
  - `GET /api/me/results/[assignmentId]`
- Student result reads are assignment-centric, use status-only reads before publish, and expose published summary/score/breakdown only from effective `PublishedResult` and `GradebookEntry`.
- The current workspace now also includes derived lifecycle/status alignment:
  - staff reads expose `operationalStatus`
  - student assignment/result reads expose `visibleStatus`
- The current workspace now also includes assignment-first staff operational reads:
  - `GET /api/staff/dashboard`
  - `GET /api/courses/[courseId]/assignments/[assignmentId]/submissions`
  - `GET /api/courses/[courseId]/assignments/[assignmentId]/submissions/[submissionId]`
- `/` now acts as the lecturer ops dashboard.
- `/jobs/new` is now the home of the legacy create-job screen.
- `/courses/[courseId]/assignments/[assignmentId]` and `/courses/[courseId]/assignments/[assignmentId]/submissions/[submissionId]` now exist as staff ops read surfaces.

## 3. Recommended Identity Model

Canonical identity model:

- `User`
  - canonical app/runtime identity
- `AuthAccount`
  - provider linkage for web auth
- `IdentityAlias`
  - legacy or institutional identity mapping
- `CourseMembership`
  - canonical course-scoped authorization record

Current implemented scope:

- `User`
- `AuthAccount`
- `IdentityAlias`
- `CourseMembership`
- `hasStaffAccess` and `hasStudentAccess` derived from canonical user + membership state

Still deferred:

- richer user profile data
- invitation workflow UX
- audit-heavy auth event tables

Transitional lineage that remains non-canonical:

- `studentRef`
- `actorRef`
- `legacy:*`
- `legacy-unresolved:*`

## 4. Recommended Role Model

Use a hybrid role model.

Global roles:

- `USER`
- `SUPER_ADMIN`

Course-scoped roles:

- `COURSE_ADMIN`
- `LECTURER`
- `STUDENT`

Current implemented authorization meaning:

- `SUPER_ADMIN`
  - full operational override
  - can access all current staff surfaces
  - required for `/api/health`
- active `COURSE_ADMIN`
  - can access staff surfaces in their own course
  - can manage memberships in their own course
- active `LECTURER`
  - can access staff surfaces in their own course
  - cannot manage course memberships
- `STUDENT`
  - can authenticate if provisioned
  - no staff access in M2

Important rule:

- there are still no flat global `ADMIN` / `LECTURER` / `STUDENT` roles

## 5. Membership Status Model

Membership status remains:

- `INVITED`
- `ACTIVE`
- `SUSPENDED`
- `REMOVED`

Current implemented rule:

- only `ACTIVE` memberships count toward coarse staff access
- non-active statuses do not authorize access

## 6. Authorization Rules

Current implemented M1+M2 rules:

- private-by-default
- all non-auth pages in `apps/web` require authenticated users
- current staff pages in `apps/web` require authenticated staff access
- current staff APIs in `apps/web` require authenticated users plus server-side role/membership checks
- `/api/health` requires `SUPER_ADMIN`
- review edit/publish remains staff-only
- publication actor now uses session-backed `user:<id>` for publish actions and new review metadata mutations
- `/api/courses` `GET`
  - `SUPER_ADMIN` sees all non-placeholder courses
  - other staff users see only courses where they hold an active `COURSE_ADMIN` / `LECTURER` membership
- `/api/courses` `POST` is now `SUPER_ADMIN` only
- `/courses/[courseId]` and `/api/courses/[courseId]` require active `COURSE_ADMIN` / `LECTURER` membership in that course unless the user is `SUPER_ADMIN`
- `/api/courses/[courseId]/lectures` and `/api/courses/[courseId]/rag/**` require active `COURSE_ADMIN` / `LECTURER` membership in that course unless the user is `SUPER_ADMIN`
- `/api/courses/[courseId]/memberships` requires active `COURSE_ADMIN` membership in that course unless the user is `SUPER_ADMIN`
- `/api/courses/[courseId]/assignments` and `/api/courses/[courseId]/assignments/[assignmentId]` require active `COURSE_ADMIN` / `LECTURER` membership in that course unless the user is `SUPER_ADMIN`
- `GET /api/staff/dashboard` is now the lecturer-facing operational aggregate and filters to courses accessible to the authenticated staff user unless the user is `SUPER_ADMIN`
- `GET /api/courses/[courseId]/assignments/[assignmentId]/submissions` and `GET /api/courses/[courseId]/assignments/[assignmentId]/submissions/[submissionId]` require active `COURSE_ADMIN` / `LECTURER` membership in that course unless the user is `SUPER_ADMIN`
- `/assignments` and `/api/me/assignments/**` are now the first student-owned surfaces
- `POST /api/me/assignments/[assignmentId]/submit` derives ownership from the authenticated user and allows only:
  - an active `STUDENT` member of the assignment course
  - or `SUPER_ADMIN` for ops/testing
- current staff users do not use the student submit route in `M3A`

Still deferred:

- exams/rubrics/jobs/reviews course ownership and route-level course scoping

## 7. Session Boundary in apps/web

Current implemented boundary:

- Auth.js in `apps/web`
- Google OAuth provider integration
- development-only Auth.js demo credentials provider for local testing
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` drive runtime auth config
- `AUTH_BOOTSTRAP_SUPER_ADMIN_EMAILS` is the bootstrap path for the first super-admin identity
- current login is provisioned-only:
  - existing linked/provisioned users may sign in
  - bootstrap super-admin emails may create the first `SUPER_ADMIN`
  - provisioned students may sign in and now get the first student submission surfaces
- demo login is enabled only when `NODE_ENV === 'development'`

## 8. Milestone Sequence

### M1. Identity and Session Foundation

Status: closed

Delivered:

- `AuthAccount` persistence
- Auth.js session boundary in `apps/web`
- canonical session principal mapped to `User`
- centralized staff/session helper logic
- private-by-default page/API protection
- coarse staff-only access for the current internal product

### M2. Course Memberships and Staff Authorization

Status: closed

Delivered:

- `PrismaCourseMembershipStore` in `@hg/postgres-store`
- idempotent membership upsert by email with canonical `User`, `IdentityAlias`, and `CourseMembership` reuse
- reusable server-side authorization helpers for authenticated users, staff, super-admin, course membership, and active course roles
- course-scoped authorization on `/courses` and `/api/courses/**`
- `SUPER_ADMIN`-only `POST /api/courses`
- minimal membership-management API on `/api/courses/[courseId]/memberships`
- minimal course-detail membership panel for `SUPER_ADMIN` and active `COURSE_ADMIN`
- development-only Auth.js demo sign-in with one real demo user for each of:
  - `SUPER_ADMIN`
  - `COURSE_ADMIN`
  - `LECTURER`
  - `STUDENT`

### M3A. Assignment and Student Submission Foundation

Status: closed

Delivered:

- `Week`, `Assignment`, and `AssignmentMaterial` runtime persistence in `@hg/postgres-store`
- narrow staff assignment authoring:
  - `GET` / `POST /api/courses/[courseId]/assignments`
  - `PATCH /api/courses/[courseId]/assignments/[assignmentId]`
- first student pages:
  - `/assignments`
  - `/assignments/[assignmentId]`
- first student own-data APIs:
  - `GET /api/me/assignments`
  - `GET /api/me/assignments/[assignmentId]`
  - `GET /api/me/assignments/[assignmentId]/prompt-raw`
  - `POST /api/me/assignments/[assignmentId]/submit`
- canonical submission ownership through `Submission.studentUserId`
- immediate DB-backed assignment grading jobs using `jobKind = ASSIGNMENT`
- exam-backed assignment grading that reuses the existing exam pipeline and current review/job flow
- closure smoke confirmed:
  - fresh assignment create with backing exam indexing
  - demo student assignment visibility and submit
  - worker processing through question extraction and per-question evaluation
  - review visibility in `/reviews`
  - publish with canonical `PublishedResult.studentUserId` and `GradebookEntry.studentUserId`

### M3B. Student Results and Own-Data Read Side

Status: closed

Delivered:

- student-safe result query/store reads in `@hg/postgres-store`
- student result schemas in `@hg/shared-schemas`
- `GET /api/me/results`
- `GET /api/me/results/[assignmentId]`
- `/results`
- `/results/[assignmentId]`
- status-only pre-publish reads with no review draft leakage
- published result detail sourced from effective `PublishedResult` and `GradebookEntry`
- narrower publish normalization hardening for per-question `GENERAL` assignment reviews so student-visible score/summary output is coherent

### Post-M3B Ops Phase

Status: closed

Delivered:

- derived lifecycle/status alignment through:
  - `OperationalSubmissionStatus`
  - `StudentVisibleAssignmentStatus`
  - staff-facing `operationalStatus`
  - student-facing `visibleStatus`
- assignment-first staff operational read models in `@hg/postgres-store`
- staff ops schemas in `@hg/shared-schemas`
- `GET /api/staff/dashboard`
- `GET /api/courses/[courseId]/assignments/[assignmentId]/submissions`
- `GET /api/courses/[courseId]/assignments/[assignmentId]/submissions/[submissionId]`
- `/` as the lecturer ops dashboard
- `/jobs/new` as the new home of the legacy create-job flow
- `/courses/[courseId]/assignments/[assignmentId]`
- `/courses/[courseId]/assignments/[assignmentId]/submissions/[submissionId]`
- assignment-first operational reads that:
  - use `Assignment` as the primary unit
  - show only the latest non-`SUPERSEDED` submission per student+assignment
  - keep `/reviews/[jobId]` as the edit/publish workspace and publish boundary
  - keep AI processing before deadline while treating deadline as a submission boundary, not a processing boundary

## 9. Recommended Immediate Next Milestone

The current auth + membership + student-flow arc is now complete through `M3B`, and the immediate post-`M3B` ops phase is now closed. The current workspace now also contains the first student lifecycle UX refinement slice:

- `/assignments` as the grouped student action workspace for `OPEN`, `SUBMITTED`, and `PUBLISHED`
- `/assignments/[assignmentId]` as the safe submit/resubmit/detail surface
- `/results` as the waiting/publication lens for submitted or published rows only
- a dedicated student assignment read model behind `/api/me/assignments/**` that derives `submittedAt`, `hasSubmission`, `hasPublishedResult`, `canSubmit`, and `canResubmit`

Follow-up work should now move to:

- route/shell/design-system unification

## 10. Validation Strategy

Current milestone validations:

- `pnpm.cmd --filter @hg/postgres-store prisma:validate`
- `pnpm.cmd --filter @hg/postgres-store test`
- `pnpm.cmd --filter @hg/postgres-store prisma:generate`
- `pnpm.cmd --filter @hg/postgres-store build`
- `pnpm.cmd --filter web exec tsc -p tsconfig.json --noEmit`
- `pnpm.cmd --filter web build`
- `pnpm.cmd --filter worker build`
- focused store/runtime coverage for:
  - assignment create/list/update
  - student assignment visibility by active `STUDENT` membership
  - assignment submission ownership and immediate job creation
  - resubmission superseding older own submissions

Manual smoke completed for the current workspace:

- unauthenticated page access redirects to `/sign-in`
- unauthenticated API access returns `401`
- authenticated non-staff access is denied with `/forbidden` for pages and `403` for staff APIs
- authenticated staff access works for protected pages and APIs
- `GET /api/health` returns `200` for `SUPER_ADMIN` and `403` for authenticated non-super-admin users
- a fresh `M3A` closure smoke verified:
  - demo course admin created an assignment with a backing exam and successful exam indexing
  - demo student saw the assignment in `/assignments`
  - demo student submitted a file and received a `jobId`
  - worker processed the assignment job through the existing exam pipeline with question extraction and per-question evaluation
  - staff saw the resulting review in `/reviews`
  - publish succeeded and kept canonical `PublishedResult.studentUserId` and `GradebookEntry.studentUserId` linkage
- the smoke used temporary signed session cookies and disposable DB users because local Google OAuth env vars are not configured in this workspace
- a fresh post-`M3B` ops closure smoke verified:
  - `/` loads as the lecturer ops dashboard
  - `Open Ops` leads from the course assignment panel into assignment-first ops pages
  - the dashboard and assignment ops pages show `SUBMITTED`, `PROCESSING`, `READY_FOR_REVIEW`, and `PUBLISHED`
  - publish through `/reviews/[jobId]` updates both the staff ops surfaces and the student published-result surfaces

## 11. Risks and Open Questions

Current risks:

- exams and rubrics are still not course-owned, so the current authz model cannot be purely course-scoped everywhere yet
- jobs can still be created without a real course, which weakens future course-based authorization on job/review flows
- current publish normalization for per-question `GENERAL` assignment reviews is technically publishable but still produces weak score/summary output and should be hardened in a follow-up
- provider-backed Google sign-in still depends on local `AUTH_SECRET` / `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` configuration and was not exercised with real external OAuth credentials in this workspace

Open questions after M3A:

- whether `/api/exams/**`, `/api/rubrics/**`, `/api/jobs/**`, and `/api/reviews/**` should remain coarse staff-only until course ownership is tightened
- how broadly the current `M3B` student-safe result semantics should expand beyond the assignment slice before tighter course ownership is applied elsewhere
