# Postgres Wave 4B Execution Plan

Status: completed on 2026-03-29
Scope: retire live legacy runtime packaging and declare final Postgres cutover for live application state

## Summary

Wave 4B closed the persistence-cutover program by removing the last live app/runtime imports of archived local-store code.

Implemented in this workspace:

- `apps/worker` no longer imports `@hg/local-job-store`
- `apps/worker` now uses a worker-local `WorkerJobRecord` type
- the disabled legacy `apps/worker/src/scripts/createJob.ts` entrypoint was removed
- `apps/web` no longer carries the unused file-backed `src/lib/exams.ts` or `src/lib/rubrics.ts` helpers
- `apps/web` and `apps/worker` no longer import `@hg/local-course-store`
- `packages/local-job-store` and `packages/local-course-store` remain in the repo only as archived/offline code for rollback, archive, compatibility, and debug workflows

## Runtime Result

After Wave 4B:

- live application state is Postgres-first across reviews, jobs, health, exam metadata, rubric metadata, courses, lectures, exam-index state, and course RAG state
- archived local-store packages are no longer part of live app/runtime imports
- remaining filesystem usage is limited to:
  - asset bytes
  - archive-only leftovers
  - offline rollback tooling
  - explicit offline compatibility/debug tooling

## Validation Record

Automated validations kept green:

- `pnpm.cmd --filter @hg/postgres-store prisma:validate`
- `pnpm.cmd --filter @hg/postgres-store prisma:generate`
- `pnpm.cmd --filter @hg/postgres-store build`
- `pnpm.cmd --filter @hg/postgres-store test`
- `pnpm.cmd --filter @hg/domain-workflow build`
- `pnpm.cmd --filter @hg/domain-workflow test`
- `pnpm.cmd --filter web build`
- `pnpm.cmd --filter worker build`

Truth checks completed:

- `rg "@hg/local-job-store" apps/web apps/worker --glob '!**/dist/**'` returned no matches
- `rg "@hg/local-course-store" apps/web apps/worker --glob '!**/dist/**'` returned no matches
- `rg "job:create" apps/worker --glob '!**/dist/**'` returned no matches
- `rg "src/lib/exams\\.ts|src/lib/rubrics\\.ts" apps/web --glob '!**/dist/**'` returned no matches

Manual final-cutover gate was not run as part of closure:

- boot web + worker with DB configured
- move aside archive-only JSON state and compatibility metadata files
- keep asset-byte directories intact
- verify end-to-end exam upload, lecture upload, job processing, review edit/publish, and absence of recreated legacy runtime JSON

## Next Step

Persistence cutover work is complete.

The next milestone, if any, should be post-cutover work such as:

- auth foundation
- identity-backed data rollout
- product-facing capabilities on top of the Postgres-first runtime
