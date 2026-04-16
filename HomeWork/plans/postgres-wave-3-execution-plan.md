# Postgres Wave 3 Execution Plan

Status: completed on 2026-03-29
Scope: exam-index live runtime cutover (`W3A`) plus course RAG and study-pointer runtime cutover (`W3B`)

## Summary

Wave 3 closed the last live runtime dependencies on file-backed derived knowledge state.

Implemented in this workspace:

- `W3A`
  - `GET` / `PUT /api/exams/[examId]/index` are DB-only
  - `apps/worker/src/scripts/generateExamIndex.ts` now saves only to Postgres in normal runtime
  - `apps/worker/src/core/loadExamIndex.ts` reads `ExamIndex.payloadJson` from Postgres
  - `apps/worker/src/core/listExamQuestionIds.ts` derives question ids from the DB-backed exam index payload
- `W3B`
  - `CourseRagIndex` and `CourseRagChunk` were added to Prisma
  - `POST /api/courses/[courseId]/rag/rebuild` writes lexical manifest/chunk state to Postgres
  - `GET /api/courses/[courseId]/rag/manifest` reads from Postgres only
  - `POST /api/courses/[courseId]/rag/query` reads from Postgres only
  - `POST /api/courses/[courseId]/rag/suggest` reads from Postgres only
  - `apps/worker/src/core/attachStudyPointers.ts` now uses the same Postgres-backed lexical retrieval path

## Runtime Result

After Wave 3:

- live web/worker runtime no longer reads:
  - `exams/<examId>/examIndex.json`
  - `courses/<courseId>/rag/manifest.json`
  - `courses/<courseId>/rag/chunks.jsonl`
- live runtime source of truth for application state is now Postgres
- remaining filesystem usage is limited to:
  - asset bytes
  - compatibility exports
  - archive/debug leftovers
  - offline rollback tooling

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
- `node_modules/.pnpm/node_modules/.bin/prisma.CMD migrate deploy --schema packages/postgres-store/prisma/schema.prisma`

Manual smoke completed:

- renamed a real `examIndex.json` out of the way and confirmed the worker could still load the DB-backed exam index and ordered question ids
- renamed a real `rag/manifest.json` and `rag/chunks.jsonl` out of the way and confirmed:
  - RAG rebuild still worked
  - manifest/query/suggest still worked from Postgres
  - `attachStudyPointers` still attached pointers from the DB-backed RAG state

The legacy files were restored after the smoke checks.

## Next Step

Wave 4.

That cleanup wave should retire live compatibility writes and remove legacy runtime dependencies that now survive only for rollback, archive, or debug purposes.
