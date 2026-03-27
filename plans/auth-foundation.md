# Auth Foundation

Status: deferred plan
Last updated: 2026-03-27

## 1. Purpose

Define the future authentication and session boundary for `apps/web` without pretending that auth already exists today.

This plan is intentionally scoped to:

- web authentication and session handling
- request/page protection boundaries
- separation of auth from grading and domain logic

It is not the current implementation.

## 2. Current state

Today the repo has:

- no implemented authentication
- no implemented session middleware
- no user table in the committed baseline
- no course membership model
- no course-scoped authorization enforcement

Sensitive APIs and pages are still open in the committed runtime baseline.

## 3. Milestone sequencing

Current sequencing matters:

1. `Domain & Workflow Foundation` is complete.
2. PostgreSQL + Prisma persistence and identity design is the approved next persistence direction, and the current branch already has a narrow committed reviews slice on that path.
3. Auth foundation is still a later milestone and must align with the eventual identity-backed architecture.

This means the old idea of treating auth as an isolated, immediate next step is no longer the active sequence.

## 4. Current approved direction

The web app should still own the auth/session boundary when this milestone eventually happens.

High-level direction:

- `apps/web` remains the place for login/session boundaries
- auth/session code stays separate from grading domain logic
- worker runtime stays out of scope
- server-side protection remains mandatory for sensitive routes and APIs

Auth.js is still a reasonable web-session direction, but detailed provider/session integration should be finalized alongside the canonical Postgres identity model rather than treated as already settled.

## 5. Scope when this milestone eventually happens

When implemented, this milestone should focus on:

- adding a real authenticated session boundary to `apps/web`
- making protected pages and APIs private by default
- keeping auth logic centralized
- avoiding worker changes
- avoiding grading-domain refactors that do not belong to auth

## 6. Out of scope

This auth milestone should still not be responsible for:

- redesigning grading workflows
- changing worker runtime
- broad UI redesign
- notifications or exports
- analytics
- assignment/exam batch runtime adoption

Course-scoped authorization may depend on the identity/membership model, but it should still remain separate from grading domain services.

## 7. Dependencies and alignment requirements

This plan must align with:

- `ARCHITECTURE.md`
- `plans/postgres-prisma-identity-design.md`

Required alignment points:

- `User` becomes the canonical identity record
- course roles belong in `CourseMembership`, not as global grading-domain flags
- `studentRef` and `actorRef` remain transitional domain refs until persistence-backed identity is in place
- auth/session behavior must not redefine the grading domain model

## 8. Validation expectations when implemented

When this milestone is eventually active, the expected validations should include:

- `pnpm --filter web build`
- `pnpm --filter worker build` only if shared imports require it

Plus focused manual checks for:

- private-by-default page behavior
- private-by-default API behavior
- login/logout flow
- preserved behavior for authenticated requests

## 9. Current reminder

This document is a deferred plan only.

It should not be read as:

- current repo behavior
- current branch behavior
- approved proof that auth is already implemented

The current approved next architecture direction is Postgres + Prisma persistence and identity design, not auth rollout first.
