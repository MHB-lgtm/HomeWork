# Commit Log

This file tracks exactly what each project commit is about, so we can quickly trace history before demos or rollbacks.

## Entry Format

- `Date`: YYYY-MM-DD
- `Commit Message`: the exact git commit title
- `Goal`: why the commit exists
- `Main Changes`: key files and behavior changes
- `Validation`: how we verified it

## Entries

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

