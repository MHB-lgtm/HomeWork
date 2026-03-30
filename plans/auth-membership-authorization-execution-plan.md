# Auth, Membership, and Authorization Execution Plan

Status: active execution plan with M1 and M2 closed
Last updated: 2026-03-30

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
- `M3` remains deferred until student-facing surfaces are approved

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
- Student access is still deferred beyond authentication and staff-surface blocking.

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
- coarse staff derivation from `CourseMembership`

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

Still deferred:

- student own-data enforcement
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
  - provisioned students may sign in but still do not get staff access
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

### M3. Student Access and Own-Data Enforcement

Status: deferred

Objective:

- add student-safe access only when student-facing surfaces are approved

## 9. Recommended Immediate Next Milestone

Implement `M2: Course Memberships and Staff Authorization`.
`M2` is now complete. The next milestone is `M3: Student Access and Own-Data Enforcement`, but it remains deferred until student-facing surfaces are approved.

## 10. Validation Strategy

Current milestone validations:

- `pnpm.cmd --filter @hg/postgres-store prisma:validate`
- `pnpm.cmd --filter @hg/postgres-store test`
- `pnpm.cmd --filter @hg/postgres-store prisma:generate`
- `pnpm.cmd --filter @hg/postgres-store build`
- `pnpm.cmd --filter web exec tsc -p tsconfig.json --noEmit`
- `pnpm.cmd --filter web build`
- `pnpm.cmd --filter worker build`

Manual smoke completed for the current workspace:

- unauthenticated page access redirects to `/sign-in`
- unauthenticated API access returns `401`
- authenticated non-staff access is denied with `/forbidden` for pages and `403` for staff APIs
- authenticated staff access works for protected pages and APIs
- `GET /api/health` returns `200` for `SUPER_ADMIN` and `403` for authenticated non-super-admin users
- the smoke used temporary signed session cookies and disposable DB users because local Google OAuth env vars are not configured in this workspace

## 11. Risks and Open Questions

Current risks:

- exams and rubrics are still not course-owned, so M2 cannot be purely course-scoped everywhere
- jobs can still be created without a real course, which weakens future course-based authorization on job/review flows
- student surfaces still do not exist, so student authorization remains intentionally deferred beyond authenticated sign-in plus staff-surface blocking
- provider-backed Google sign-in still depends on local `AUTH_SECRET` / `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` configuration and was not exercised with real external OAuth credentials in this workspace

Open questions after M2:

- whether `/api/exams/**`, `/api/rubrics/**`, `/api/jobs/**`, and `/api/reviews/**` should remain coarse staff-only until course ownership is tightened
- when assignment/exam ownership should be made explicitly course-bound
