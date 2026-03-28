# Postgres Wave 1 Execution Plan

Status: approved execution plan for Wave 1 implementation
Last updated: 2026-03-27

## Summary

Full Wave 1 is too large to finish safely in one pass. Repo inspection shows a real boundary between:

- grading-input content that directly blocks Wave 2,
- course and lecture content that remains coupled to unchanged RAG runtime.

Wave 1 is therefore split into exactly two parts:

- `W1A`: exams, rubrics, and exam-index metadata registration
- `W1B`: courses and lectures

`W1A` is the next implementation target because `/api/jobs` and the legacy worker still depend directly on exam metadata, rubric files, and `examIndex.json`.

## Repo Truth That Drives The Split

- `apps/web/src/app/api/exams/**`, `apps/web/src/app/api/rubrics/**`, and `apps/web/src/app/api/exams/[examId]/index/route.ts` are still fully file-backed.
- `apps/web/src/app/api/jobs/route.ts` still resolves grading inputs through `apps/web/src/lib/exams.ts` and `apps/web/src/lib/rubrics.ts`.
- `apps/worker/src/scripts/generateExamIndex.ts` still reads `exam.json` and writes `examIndex.json` directly.
- `apps/worker/src/core/loadExamIndex.ts` and `apps/worker/src/core/listExamQuestionIds.ts` still read `examIndex.json` and rubric JSON files directly.
- `courses` and `lectures` are also file-backed, but their unchanged runtime consumers are mainly RAG-adjacent:
  - `apps/web/src/app/api/courses/**`
  - `apps/web/src/app/api/courses/[courseId]/rag/**`
  - `apps/worker/src/core/attachStudyPointers.ts`
- `@hg/postgres-store` already has partial building blocks for `Course`, `StoredAsset`, and lecture import, but it has no runtime models yet for exams, rubrics, exam indexes, or lecture metadata as a first-class runtime row.

## W1A

### Goal

Make exams, rubrics, and exam-index metadata Postgres-first in `apps/web`, while preserving legacy worker and job-route compatibility through one-way DB-to-filesystem materialization only.

### Systems Moved

- exam metadata ownership
- exam asset ownership metadata
- rubric storage
- exam-index metadata registration
- narrow exam-index writer path in `apps/worker/src/scripts/generateExamIndex.ts`

### Required Postgres Runtime Additions

Add runtime models in `packages/postgres-store/prisma/schema.prisma`:

- `Exam`
  - `domainId` stores the existing `examId`
  - `title`
  - `assetId -> StoredAsset`
  - `createdAt`
  - `updatedAt`
- `Rubric`
  - `examId -> Exam`
  - `questionId`
  - `title`
  - `generalGuidance`
  - `criteriaJson`
  - `rawPayload`
  - `createdAt`
  - `updatedAt`
  - unique on `(examId, questionId)`
- `ExamIndex`
  - `examId -> Exam`
  - `status`
  - `generatedAt`
  - `updatedAt`
  - `payloadJson`
  - unique on `examId`

Rules:

- asset bytes stay on the filesystem
- Postgres owns the metadata, not the blob
- standalone exams do not reuse `CourseMaterial`
- rubric and exam-index payloads stay in `jsonb`

### Runtime Stores And Queries

Add Postgres runtime stores under `packages/postgres-store/src/**`:

- `PrismaExamStore`
  - `listExams`
  - `getExam`
  - `createExam`
- `PrismaRubricStore`
  - `listRubricQuestionIds`
  - `getRubric`
  - `saveRubric`
- `PrismaExamIndexStore`
  - `getExamIndex`
  - `saveExamIndex`

Expand `apps/web/src/lib/server/persistence.ts` so the web runtime resolves these stores directly.

### Web Cutover

Flip these routes to DB-first:

- `apps/web/src/app/api/exams/route.ts`
- `apps/web/src/app/api/exams/[examId]/route.ts`
- `apps/web/src/app/api/exams/[examId]/index/route.ts`
- `apps/web/src/app/api/rubrics/route.ts`
- `apps/web/src/app/api/rubrics/[examId]/[questionId]/route.ts`

Behavior rules:

- reads come from Postgres
- writes go to Postgres
- compatibility files are materialized only after successful DB writes
- no direct JSON file writes remain in these routes
- `apps/web/src/app/api/jobs/**` remains unchanged and keeps consuming compatibility files

Environment rules:

- migrated W1A routes require `DATABASE_URL`
- W1A write paths also require `HG_DATA_DIR`
- missing DB configuration is a persistence error, not a reason to fall back to direct file authoring

### Compatibility Materialization

Add a narrow exporter module in `@hg/postgres-store` that atomically materializes only:

- `exams/<examId>/exam.json`
- `exams/<examId>/assets/<original-file>`
- `rubrics/<examId>/<questionId>.json`
- `exams/<examId>/examIndex.json`

Rules:

- DB rows are authoritative
- compatibility files are derived outputs only
- exporters must be idempotent and atomic
- exporters run after:
  - web writes
  - importer writes
  - exam-index saves from the worker script

Legacy consumers still depending on these outputs:

- `apps/web/src/app/api/jobs/route.ts`
- `apps/web/src/lib/exams.ts`
- `apps/web/src/lib/rubrics.ts`
- `apps/worker/src/scripts/generateExamIndex.ts`
- `apps/worker/src/core/loadExamIndex.ts`
- `apps/worker/src/core/listExamQuestionIds.ts`

### Import / Backfill

Extend `packages/postgres-store/src/import-file-backed.ts` to backfill:

- `exams/*/exam.json`
- exam assets referenced by exam metadata
- `rubrics/**`
- `exams/*/examIndex.json`

Importer requirements:

- rerunnable
- keep `--dry-run`
- explicit unresolved and failed categories
- second-run idempotent
- no silent drops

Add summary counters:

- `importedExams`
- `importedRubrics`
- `importedExamIndexes`

### Narrow Worker Change Allowed In W1A

`apps/worker/src/scripts/generateExamIndex.ts` may change only in this narrow way:

- still read exam assets from compatibility-backed filesystem paths
- stop treating `examIndex.json` as authoritative output
- save the validated exam index through `PrismaExamIndexStore`
- let the save path materialize `examIndex.json`

This is not worker queue migration.

### Validation And Acceptance

Run:

- `pnpm.cmd --filter @hg/postgres-store prisma:validate`
- `pnpm.cmd --filter @hg/postgres-store prisma:generate`
- `pnpm.cmd --filter @hg/postgres-store build`
- `pnpm.cmd --filter @hg/postgres-store test`
- `pnpm.cmd --filter @hg/domain-workflow build`
- `pnpm.cmd --filter @hg/domain-workflow test`
- `pnpm.cmd --filter web build`
- `pnpm.cmd --filter worker build`

Wave-specific checks:

- importer dry-run
- real importer run
- second importer run
- parity counts for exams, rubrics, and exam indexes
- sampled payload parity for one exam, one rubric, and one exam index
- exported compatibility files exist and match DB-owned payloads

Manual checks:

- create an exam in `/exams` and confirm it still appears there
- verify exported `exam.json` and asset file exist
- save a rubric in `/rubrics` and confirm it reloads correctly
- create a job from `/` and confirm it still resolves exam and rubric inputs
- run exam index generation and confirm `GET /api/exams/[examId]/index` is DB-backed while `examIndex.json` still exists as an exported compatibility file

## W1B

### Goal

Make courses and lectures Postgres-first in `apps/web`, while preserving current RAG routes and worker study-pointer consumers through one-way DB-to-filesystem materialization until Wave 3.

### Systems Moved

- course metadata ownership
- lecture metadata ownership
- lecture asset ownership metadata

### Required Runtime Additions

Reuse `Course` rows, but add a dedicated `Lecture` runtime model:

- `domainId` stores the existing `lectureId`
- `courseId -> Course`
- `assetId -> StoredAsset`
- `title`
- `sourceType`
- `externalUrl`
- `createdAt`
- `updatedAt`

Add `PrismaLectureStore` with:

- `listLectures`
- `getLecture`
- `createLecture`

Do not overload `CourseMaterial` for lecture runtime metadata.

### Web Cutover

Flip these routes to DB-first:

- `apps/web/src/app/api/courses/route.ts`
- `apps/web/src/app/api/courses/[courseId]/route.ts`
- `apps/web/src/app/api/courses/[courseId]/lectures/route.ts`

Do not migrate `apps/web/src/app/api/courses/[courseId]/rag/**` in W1B.

### Compatibility Materialization

Materialize only the files still needed by unchanged RAG consumers:

- `courses/<courseId>/course.json`
- `courses/<courseId>/lectures/<lectureId>/lecture.json`
- lecture asset files under their current layout

Those files remain compatibility outputs only.

### Import / Backfill And Validation

Extend importer coverage for:

- `courses/*/course.json`
- `courses/*/lectures/*/lecture.json`
- lecture assets

Validate parity for:

- courses
- lectures

Manual checks:

- create a course and confirm it appears in `/courses`
- upload a lecture and confirm it appears under `/courses/[courseId]`
- rebuild and query RAG successfully through compatibility files

## Defaults

- `W1A` is the implementation target now.
- `W1A` and `W1B` are the only Wave 1 split.
- `DATABASE_URL` is required for migrated Wave 1 surfaces.
- `HG_DATA_DIR` remains required for asset bytes and compatibility exports.
- no auth/session/membership work
- no queue/claim/lease/heartbeat/job-status migration
- no review fallback removal
- no RAG runtime migration before Wave 3
