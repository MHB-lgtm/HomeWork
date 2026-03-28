# Postgres Wave 1 Execution Plan

Status: implemented Wave 1 execution record
Last updated: 2026-03-28

## Summary

Wave 1 is now split and implemented as:

- `W1A`: exams, rubrics, and exam-index metadata
- `W1B`: courses and lectures

Across both halves, the user-facing authoring surfaces in `apps/web` are now DB-first, while unchanged legacy consumers still read compatibility artifacts from `HG_DATA_DIR`.

Wave 1 is complete when read as an authoring/input-source migration:

- exams are DB-first
- rubrics are DB-first
- exam-index metadata registration is DB-first
- courses are DB-first
- lectures are DB-first

Wave 2 remains the next operational cutover because jobs, worker queue state, worker heartbeat, and new review generation are still file-backed.

## Implemented W1A

Implemented DB-first surfaces:

- `GET` / `POST /api/exams`
- `GET /api/exams/[examId]`
- `GET` / `PUT /api/exams/[examId]/index`
- `GET` / `POST /api/rubrics`
- `GET /api/rubrics/[examId]/[questionId]`

Implemented compatibility outputs:

- `exams/<examId>/exam.json`
- `exams/<examId>/assets/*`
- `rubrics/<examId>/<questionId>.json`
- `exams/<examId>/examIndex.json`

Unchanged consumers still using those outputs:

- `apps/web/src/app/api/jobs/**`
- `apps/web/src/lib/exams.ts`
- `apps/web/src/lib/rubrics.ts`
- `apps/worker/src/core/loadExamIndex.ts`
- `apps/worker/src/core/listExamQuestionIds.ts`
- `apps/worker/src/scripts/generateExamIndex.ts` for exam asset reads

## Implemented W1B

Implemented DB-first surfaces:

- `GET` / `POST /api/courses`
- `GET /api/courses/[courseId]`
- `GET` / `POST /api/courses/[courseId]/lectures`

Implemented runtime additions:

- dedicated `Lecture` runtime table in Postgres
- `PrismaCourseStore`
- `PrismaLectureStore`
- rerunnable import of `course.json`, `lecture.json`, and lecture assets into:
  - `Course`
  - `Lecture`
  - `StoredAsset`
  - companion `CourseMaterial` lecture projection

Implemented compatibility outputs:

- `courses/<courseId>/course.json`
- `courses/<courseId>/lectures/<lectureId>/lecture.json`
- `courses/<courseId>/lectures/<lectureId>/assets/*`

Unchanged consumers still using those outputs:

- `apps/web/src/app/api/courses/[courseId]/rag/**`
- `packages/local-course-store/src/fileCourseRagIndex.ts`
- `apps/worker/src/core/attachStudyPointers.ts`

## Export-Failure Policy

Wave 1 now uses one explicit policy for DB-authoritative writes followed by compatibility export:

1. validate request input first
2. write authoritative DB state
3. run compatibility materialization immediately after
4. if export succeeds, return normal success
5. if export fails:
   - do not roll back the DB write
   - do not delete the created DB row
   - do not fall back to direct file authoring
   - return `500` with code `COMPAT_EXPORT_FAILED`
   - include the created entity id in the error payload
   - log the entity id and failed export targets

Recovery rule:

- DB remains the source of truth
- repair is done by rerunning deterministic exporters through importer/backfill or direct reuse of the exporter helpers

Importer rule:

- if DB upsert succeeds but compatibility export fails, the importer records the row as `failed`, leaves DB state in place, and continues
- second-run idempotency is expected to heal missing compatibility files without duplicating DB rows

## Scope Guard

Wave 1 does not implement course or lecture edit/delete flows.

Repo inspection confirmed that the current product has no existing:

- `PUT` / `PATCH` / `DELETE` course routes
- `PUT` / `PATCH` / `DELETE` lecture routes
- course edit/delete UI actions
- lecture edit/delete UI actions
- client methods for course/lecture update/delete

So Wave 1 scope remains:

- course create/list/get
- lecture upload/list

## Validation Expectations

Wave 1 validation still means keeping these green:

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
- importer real run
- importer second real run
- parity counts for:
  - courses
  - lectures
  - exams
  - rubrics
  - exam indexes
- manual create/read smoke for:
  - exams
  - rubrics
  - courses
  - lectures
  - course RAG rebuild via compatibility outputs

## Next Scope

Wave 1 is complete enough to stop safely.

The next approved scope is Wave 2:

- jobs API cutover
- worker queue and status cutover
- worker heartbeat cutover
- new review persistence cutover

Do not open auth or student-facing publication work before the grading pipeline moves.
