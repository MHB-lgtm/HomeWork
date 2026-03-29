# Auth, Membership, and Authorization Execution Plan

Status: active execution plan with M1 closed
Last updated: 2026-03-29

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

- `M1` is now closed
- `M2` is the next milestone
- `M3` remains deferred until student-facing surfaces are approved

## 2. Current Repo Truth

- `apps/web` now has an implemented Auth.js session boundary.
- Login/session is staff-only and private-by-default for the current internal product.
- All current non-auth pages are behind authenticated staff access.
- All current non-auth API routes are behind authenticated staff access.
- `GET /api/health` is now `SUPER_ADMIN` only.
- Prisma schema now includes:
  - `User`
  - `AuthAccount`
  - `IdentityAlias`
  - `CourseMembership`
- `packages/postgres-store` now includes a user-auth query layer used by `apps/web`.
- Coarse staff access is currently derived from:
  - `SUPER_ADMIN`
  - or any active `COURSE_ADMIN` / `LECTURER` membership
- Course-scoped authorization is not yet enforced route-by-route.
- Student access is still deferred.

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
- active `COURSE_ADMIN` or `LECTURER`
  - allowed into the current internal staff app
- `STUDENT`
  - schema-level only for now
  - no staff access

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

Current implemented M1 rules:

- private-by-default
- all non-auth pages in `apps/web` require authenticated staff access
- all non-auth API routes in `apps/web` require authenticated staff access
- `/api/health` requires `SUPER_ADMIN`
- review edit/publish remains staff-only
- publication actor now uses session-backed `user:<id>` for publish actions and new review metadata mutations

Still deferred:

- course membership filtering on `/courses`
- course-scoped authorization on `/api/courses/**`
- student own-data enforcement
- staff-vs-course-admin write distinctions

## 7. Session Boundary in apps/web

Current implemented boundary:

- Auth.js in `apps/web`
- Google OAuth provider integration
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` drive runtime auth config
- `AUTH_BOOTSTRAP_SUPER_ADMIN_EMAILS` is the bootstrap path for the first super-admin identity
- current login is provisioned-only:
  - existing linked/provisioned users may sign in
  - bootstrap super-admin emails may create the first `SUPER_ADMIN`
  - non-staff users are denied

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

Status: next

Objective:

- make current authorization truly course-aware where the repo model supports it

Planned scope:

- membership query/store layer for route authorization
- filter `/courses` to active memberships unless `SUPER_ADMIN`
- enforce course membership on `/courses/[courseId]` and `/api/courses/**`
- introduce staff-only vs course-admin-only rules where current routes justify them

Out of scope:

- student portal rollout
- worker auth changes
- exam/course ownership redesign

### M3. Student Access and Own-Data Enforcement

Status: deferred

Objective:

- add student-safe access only when student-facing surfaces are approved

## 9. Recommended Immediate Next Milestone

Implement `M2: Course Memberships and Staff Authorization`.

That is the next smallest durable step because:

- session identity already exists
- staff-only protection already exists
- course membership schema already exists
- current product still lacks true course-scoped filtering and enforcement

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
- student surfaces still do not exist, so student authorization remains intentionally deferred
- provider-backed Google sign-in still depends on local `AUTH_SECRET` / `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` configuration and was not exercised with real external OAuth credentials in this workspace

Open questions for M2, not blockers for M1:

- whether `/api/exams/**`, `/api/rubrics/**`, `/api/jobs/**`, and `/api/reviews/**` should remain coarse staff-only until course ownership is tightened
- what the first membership-management surface should be
- when assignment/exam ownership should be made explicitly course-bound
