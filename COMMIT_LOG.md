# Commit Log

This file tracks exactly what each project commit is about, so we can quickly trace history before demos or rollbacks.

## Entry Format

- `Date`: YYYY-MM-DD
- `Commit Message`: the exact git commit title
- `Goal`: why the commit exists
- `Main Changes`: key files and behavior changes
- `Validation`: how we verified it

## Entries

### 2026-03-22
- `Commit Message`: `feat(ui): extend immersive shell across app and tighten general feedback output`
- `Goal`: make the repository share-ready by unifying the main product surfaces under the home-page visual language and tightening GENERAL review output for easier reading.
- `Main Changes`:
  - `apps/web/src/components/layout/ImmersiveShell.tsx`
    - added a reusable immersive shell with the floating pill navigation and shared gradient background.
  - `apps/web/src/components/layout/AppShell.tsx`
    - switched `/exams`, `/rubrics`, `/reviews`, and `/courses` routes to immersive rendering.
  - `apps/web/src/app/exams/page.tsx`
  - `apps/web/src/app/rubrics/page.tsx`
  - `apps/web/src/app/reviews/page.tsx`
  - `apps/web/src/app/reviews/[jobId]/page.tsx`
  - `apps/web/src/app/courses/page.tsx`
  - `apps/web/src/app/courses/[courseId]/page.tsx`
    - aligned page headers, surfaces, spacing, and backgrounds to the home blueprint while preserving route behavior.
  - `apps/worker/src/core/generalEvaluatePerQuestion.ts`
    - constrained GENERAL feedback to 1-2 concise findings per question and required a short per-question summary with fallback generation.
  - `docs/ui-blueprint/*`
    - added blueprint docs that describe the home visual language and how it maps to the rest of the product.
- `Validation`:
  - `pnpm.cmd --filter web exec tsc -p tsconfig.json --noEmit` (success).
  - `pnpm.cmd --filter worker exec tsc -p tsconfig.json --noEmit` (success).
  - `pnpm.cmd --filter worker build` (success).
  - `GET /api/health`, `GET /api/exams`, `GET /api/reviews` against local dev server (success).

### 2026-02-23
- `Commit Message`: `feat: polish review workflow for demo and capture UI redesign context`
- `Goal`: stabilize the review UX for presentation and document current UI state before redesign work.
- `Main Changes`:
  - `apps/web/src/app/reviews/[jobId]/page.tsx`
    - adjusted right-sidebar auto-scroll to center the selected finding/annotation instead of clipping near top.
  - `apps/web/src/app/reviews/page.tsx`
    - added inline review naming UX (add/edit custom display name in All Reviews).
  - `apps/web/src/lib/reviewsClient.ts`
    - added client helper for review display name update.
  - `apps/web/src/app/api/reviews/[jobId]/route.ts`
    - added `PATCH /api/reviews/[jobId]` for review metadata update (`displayName`).
  - `apps/web/src/app/api/reviews/route.ts`
    - list response now includes `displayName` when available.
  - `packages/shared-schemas/src/review/v1/schemas.ts`
    - extended `ReviewRecord` with optional `displayName`.
  - `packages/shared-schemas/src/general/v1/schemas.ts`
    - changed per-question findings minimum from 3 to 1 and removed strict strength+issue combination requirement.
  - `apps/worker/src/core/generalEvaluatePerQuestion.ts`
    - updated prompts/validation to enforce at least 1 finding (not 3), while still allowing multiple findings.
  - `docs/ui-audit/*`
    - added UI Context Pack: current-state report, inventory JSON, screenshot plan, and redesign target brief.
- `Validation`:
  - `pnpm --filter @hg/shared-schemas build` (success).
  - `pnpm --filter worker build` (success).
  - `pnpm --filter web exec tsc -p tsconfig.json --noEmit` (success).

### 2026-02-23
- `Commit Message`: `chore: freeze demo baseline with english exam indexing and UI audit docs`
- `Goal`: lock a minimal, presentable checkpoint before the next UI polish cycle, with clear rollback reference.
- `Main Changes`:
  - `apps/worker/src/scripts/generateExamIndex.ts`
    - enforced English output for indexed question text fields (`displayLabel`, `aliases`, `promptText`).
    - added automatic retry/repair when non-English (Hebrew) text is detected in generated question metadata.
  - `apps/web/src/app/api/exams/route.ts`
    - fixed auto-index command argument format to call worker indexing reliably from exam upload flow.
  - `ARCHITECTURE.md`
    - replaced with a focused "current-state" architecture document aligned to active runtime flows.
  - `docs/ui-current-state.md`
    - added discovery audit of current UI stack, route composition, component inventory, and redesign pain points.
  - `docs/ui-inventory.json`
    - added machine-readable UI inventory (routes, stack flags, component index).
- `Validation`:
  - `pnpm --filter worker build` (success).

### 2026-02-25
- `Commit Message`: `feat(web): polish home hero and task-first review flows`
- `Goal`: shift the product UX toward a cleaner task-first demo flow while keeping grading behavior unchanged.
- `Main Changes`:
  - `apps/web/src/app/page.tsx`
    - simplified the home hero copy and centered the grading flow around the default `GENERAL + DOCUMENT + PDF` path.
    - reduced visible technical language, moved advanced options behind disclosure, and polished the floating marketing-style nav.
    - softened progress step colors and tightened the main hero/form rhythm for presentation.
  - `apps/web/src/app/reviews/page.tsx`
    - improved “All Reviews” presentation and naming workflow so review display names can be edited from the list.
  - `apps/web/src/app/reviews/[jobId]/page.tsx`
    - refined review detail scrolling/selection behavior and improved sidebar readability for demo use.
- `Validation`:
  - `pnpm --filter web exec tsc -p tsconfig.json --noEmit` (success).

### 2026-02-25
- `Commit Message`: `ui(home): polish floating navbar and hero/form spacing`
- `Goal`: freeze a visually cleaner Home page baseline before broader immersive-shell rollout.
- `Main Changes`:
  - `apps/web/src/app/page.tsx`
    - finalized the floating pill navbar positioning and spacing.
    - centered the hero block and added cleaner separation between hero text and the upload form.
    - tightened title/subtitle copy and typography for the presentation homepage.
- `Validation`:
  - `pnpm --filter web exec tsc -p tsconfig.json --noEmit` (success).

### 2026-02-22
- `Commit Message`: `fix: stabilize review status badge and add presentation smoke runbook`
- `Goal`: make the review UI status reliable and create a repeatable pre-presentation smoke flow.
- `Main Changes`:
  - `apps/web/src/app/reviews/[jobId]/page.tsx`
    - fixed status badge mapping to match real job statuses (`PENDING|RUNNING|DONE|FAILED`).
    - cleaned the error-state "Back to Home" text.
  - `scripts/presentation-smoke.ps1`
    - added an automated smoke script to:
      - start web server,
      - create a new exam via API,
      - create a new GENERAL/DOCUMENT job,
      - run worker once (`job:run-once`),
      - verify final job status and review list count.
  - `.gitignore`
    - ignored `.codex-runlogs/`.
- `Validation`:
  - `pnpm --filter web build` (success).
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/presentation-smoke.ps1` (success: job reached `DONE`).

### 2026-02-22
- `Commit Message`: `feat: auto-index exam immediately after upload`
- `Goal`: ensure exam question indexing starts right after exam upload, without manual worker command in normal flow.
- `Main Changes`:
  - `apps/web/src/app/api/exams/route.ts`
    - after exam creation, API now triggers auto-indexing by running:
      - `pnpm --filter worker exam:index -- --examId <examId>`
    - response now includes `indexing` status (`ok`, `message`, optional `details`).
  - `apps/web/src/lib/examsClient.ts`
    - extended create-exam client response with optional `indexing` payload.
  - `apps/web/src/app/exams/page.tsx`
    - improved success feedback:
      - success when indexed,
      - warning when exam is created but indexing fails (with manual fallback command).
  - `apps/worker/src/scripts/generateExamIndex.ts`
    - fixed `.env` resolution to repo root for reliable key loading.
  - `FLOW_RUNBOOK.md`
    - documented the updated end-to-end flow and exactly when split/index happens.
- `Validation`:
  - `pnpm --filter web build` (success).
  - `pnpm --filter worker build` (success).
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/presentation-smoke.ps1` (success: job reached `DONE`).
