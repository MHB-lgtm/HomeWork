# Auth Foundation - Milestone 1

## Goal

Add a production-quality authentication foundation to `apps/web` using Auth.js with Google as the first identity provider and JWT/stateless cookie sessions.

Milestone 1 must:
- make the product private by default,
- keep auth separate from domain logic,
- protect sensitive UI routes and API routes,
- add a minimal login/logout flow,
- avoid any database or domain-schema changes.

## Non-goals

This milestone does not include:
- RBAC or roles,
- ownership fields on exams, jobs, reviews, rubrics, courses, or lectures,
- invitations, teams, or multi-tenancy,
- user profile management,
- worker authentication changes,
- database or ORM introduction,
- business-logic refactors outside auth boundaries.

## Current-state summary

- The repo is a pnpm monorepo with `apps/web` as a Next.js App Router app and `apps/worker` as a separate background worker.
- Product APIs already exist under `apps/web/src/app/api/**`.
- The product is currently unauthenticated.
- Persistence is file-backed through local store packages; there is no DB or ORM.
- Sensitive flows already exist for uploads, raw submission access, review editing, and course indexing.
- Current domain stores and worker behavior must remain unchanged in this milestone.

## Approved architectural decisions

- Auth library: Auth.js.
- First provider: Google only.
- Session strategy: JWT/stateless cookie session.
- Public routes:
  - `/login`
  - `/api/auth/*`
  - `/api/health`
  - Next.js static/public assets required for runtime
- All other product pages and product API routes are private by default.
- No DB, ORM, RBAC, ownership model, or domain-scoping changes in Milestone 1.
- Prefer centralized auth boundaries over page-by-page ad hoc checks.
- Prefer one root auth module, one middleware boundary, and small shared server guard helpers.
- Keep diffs minimal and preserve current business behavior for authenticated users.

## Exact file plan for Milestone 1

### Auth core
- `apps/web/package.json`
  - Add the Auth.js dependency for Next.js.
- `apps/web/src/auth.ts`
  - Central Auth.js configuration.
  - Export the configured auth helper and route handlers.
  - Configure Google provider and JWT session strategy.
- `apps/web/src/middleware.ts`
  - Centralized default-private route gate for page and API requests.
  - Exclude public routes and static assets.
- `apps/web/src/app/api/auth/[...nextauth]/route.ts`
  - Expose Auth.js route handlers.

### Shared server auth helpers
- `apps/web/src/lib/auth/guards.ts`
  - Export reusable guards for secure server-side enforcement.
  - One helper for API route handlers that returns a uniform unauthorized response.
  - One helper for authenticated page access in server-rendered entrypoints if needed.
- `apps/web/src/lib/auth/redirects.ts`
  - Export internal-only redirect target validation for `next`/callback handling.
  - Reject external URLs and normalize fallback to `/`.

### Auth UI
- `apps/web/src/app/login/page.tsx`
  - Public login page with a minimal Google sign-in UI.
  - Redirect authenticated users to the validated `next` target or `/`.
- `apps/web/src/components/auth/GoogleSignInButton.tsx`
  - Small client component that starts Google sign-in and passes the validated callback target.
- `apps/web/src/components/auth/SignOutButton.tsx`
  - Small client component that signs the user out and returns them to `/login`.
- `apps/web/src/components/layout/AppShell.tsx`
  - Add a minimal sign-out affordance to the existing shell header.
- `apps/web/src/components/layout/ImmersiveShell.tsx`
  - Add the same minimal sign-out affordance for immersive pages.

### API route enforcement
Add explicit server-side auth guards at the start of every product route handler under:
- `apps/web/src/app/api/exams/**/route.ts`
- `apps/web/src/app/api/jobs/**/route.ts`
- `apps/web/src/app/api/reviews/**/route.ts`
- `apps/web/src/app/api/rubrics/**/route.ts`
- `apps/web/src/app/api/courses/**/route.ts`

Do not guard:
- `apps/web/src/app/api/auth/**`
- `apps/web/src/app/api/health/route.ts`

### Docs to update after implementation
- `ARCHITECTURE.md`
- `FLOW_RUNBOOK.md`

These doc updates are part of Milestone 1 closeout, not part of the auth code itself.

## Route protection strategy

### Central rule
Use `apps/web/src/middleware.ts` as the default-private boundary.

### Public allowlist
The middleware must allow:
- `/login`
- `/api/auth/:path*`
- `/api/health`
- `/_next/:path*`
- asset files requested by extension, including `favicon.ico` and public/static asset requests

### Private by default
Everything else is private, including:
- `/`
- `/exams`
- `/rubrics`
- `/reviews`
- `/reviews/[jobId]`
- `/courses`
- `/courses/[courseId]`
- all product API routes outside the public allowlist

### Request behavior
- Unauthenticated page requests:
  - redirect to `/login?next=<internal-path>`
- Unauthenticated API requests:
  - return `401` JSON
  - do not redirect APIs to `/login`

### Boundary separation
Middleware is the centralized optimistic gate.
Secure server-side checks in route handlers remain required for defense in depth and must not be skipped.

## API protection strategy

### Central API policy
All product APIs are private by default.
Middleware enforces the default.
Route handlers also enforce session presence explicitly.

### Explicit guarded API groups
Apply the shared API session guard to:
- exams routes
- jobs routes
- reviews routes
- rubrics routes
- courses routes

### Unauthorized API response shape
Use a single consistent unauthorized response:
- HTTP status: `401`
- JSON body:
  - `{ ok: false, error: "UNAUTHORIZED" }`

### Backward compatibility
For authenticated requests, existing handler behavior and response shapes must remain unchanged.
Only unauthenticated behavior changes in this milestone.

## Session handling strategy

- Use Auth.js JWT sessions only.
- Do not use a database adapter.
- Do not create or persist an app-level user record.
- Store only identity/session data managed by Auth.js cookies and token callbacks.
- Treat session presence as the only authorization condition in Milestone 1.
- Do not add roles or resource-level authorization.
- Use `AUTH_SECRET` for signing/encryption.
- Keep all secure checks server-side through Auth.js server helpers and shared guards.
- Do not depend on client-only session reads for security.
- Do not add a global `SessionProvider` unless implementation proves it is necessary; Milestone 1 should avoid it by default.

## Login/logout flow

### Login
- Visiting `/login` is always allowed.
- If the request already has a valid session, redirect to:
  - the validated internal `next` target if present,
  - otherwise `/`
- The page renders a single primary Google sign-in action.
- Starting sign-in sends the user through Google OAuth and returns them to:
  - the validated internal `next` target if present,
  - otherwise `/`

### Redirect validation
- Only internal relative paths are accepted for `next`.
- Any missing, malformed, or external redirect target falls back to `/`.
- Open redirects are not allowed.

### Logout
- Authenticated shells expose a minimal logout affordance.
- Logout returns the user to `/login`.
- No user menu, profile page, or account settings are included in this milestone.

## Env vars expected

Required:
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`

Optional:
- `AUTH_URL`
  - only if host detection is unreliable in the deployment environment

Existing env vars that remain unchanged:
- `HG_DATA_DIR`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

## Validation commands

Use existing repo commands only.

Primary web validation:
- `pnpm --filter web build`
- `pnpm --filter web lint`

If shared imports or cross-package contracts are touched:
- `pnpm --filter worker build`

Local runtime checks:
- `pnpm --filter web dev`
- `pnpm --filter worker job:run-loop`

Operational checks after local startup:
- `curl.exe http://localhost:3000/api/health`

Windows note:
- On local PowerShell setups that block `pnpm.ps1`, use `pnpm.cmd` instead.

## Manual acceptance checklist

### Public route behavior
- `/login` loads without authentication.
- `/api/auth/*` is reachable for Auth.js flows.
- `/api/health` remains public.
- Next.js assets and static files still load.

### Page protection
- Unauthenticated request to `/` redirects to `/login`.
- Unauthenticated request to `/exams` redirects to `/login`.
- Unauthenticated request to `/reviews/<jobId>` redirects to `/login`.
- Unauthenticated request to `/courses` redirects to `/login`.

### API protection
- Unauthenticated request to a product API route under `/api/exams`, `/api/jobs`, `/api/reviews`, `/api/rubrics`, or `/api/courses` returns `401` JSON.
- Authenticated requests to those APIs still work with their existing behavior.

### Login/logout
- Google login succeeds locally with configured credentials.
- Successful login returns to the intended internal route.
- Logout returns to `/login`.

### Product regression
- Authenticated exam upload still works.
- Authenticated review creation still works.
- Authenticated review viewing still works.
- Authenticated course creation and RAG rebuild still work.
- Worker loop behavior is unchanged.

## Risks and follow-ups

### Risks
- Google OAuth callback configuration can block local or deployment testing if the provider setup is incomplete.
- Middleware matcher mistakes can accidentally block assets or leave routes unintentionally public.
- Milestone 1 makes the app private, but all authenticated users still share the same file-backed data because ownership is intentionally out of scope.
- The product uses both `AppShell` and `ImmersiveShell`; logout access must be added to both to avoid inconsistent UX.

### Follow-ups after Milestone 1
- Add per-user or per-tenant ownership to domain resources.
- Introduce a DB/ORM only when ownership and richer identity state become necessary.
- Add RBAC or administrative capabilities only after ownership exists.
- Decide whether to add a richer account/session UI after the foundation is stable.

## Definition of done

Milestone 1 is done when:
- Auth.js is wired into `apps/web` with Google as the only provider.
- JWT/stateless cookie sessions are active.
- `/login`, `/api/auth/*`, `/api/health`, and static assets are public.
- All other product pages are private by default.
- All product API route groups are protected both centrally and explicitly.
- Login and logout work end-to-end.
- Existing product behavior remains unchanged for authenticated users.
- No database, ORM, RBAC, ownership fields, or worker changes were introduced.
- Relevant validations pass.
- Architecture and runbook docs are updated to reflect the new auth foundation.
```
