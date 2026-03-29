# Auth Foundation

Status: foundation milestone closed; superseded by `plans/auth-membership-authorization-execution-plan.md`
Last updated: 2026-03-29

## 1. Purpose

Record the web auth/session boundary that is now implemented in `apps/web`, and point future work at the active execution plan.

## 2. Current state

Today the repo has:

- implemented Auth.js session handling in `apps/web`
- canonical session identity backed by Postgres `User`
- provider linkage via `AuthAccount`
- centralized server-side staff/session helpers
- private-by-default pages and APIs for the current internal staff product
- `SUPER_ADMIN`-only protection on `/api/health`

Still not implemented:

- course-scoped authorization enforcement
- course membership filtering on live routes
- student-facing own-data access

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
