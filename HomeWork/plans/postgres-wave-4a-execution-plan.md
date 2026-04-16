# Postgres Wave 4A Execution Plan

Status: completed on 2026-03-29
Scope: remove live compatibility writes and narrow `HG_DATA_DIR` to asset-byte paths plus explicit offline/archive tooling

## Summary

Wave 4A closed the last live compatibility-write paths that survived after Waves 1-3.

Implemented in this workspace:

- live `POST /api/exams` no longer writes `exams/<examId>/exam.json`
- live `POST /api/rubrics` no longer writes `rubrics/<examId>/*.json`
- live `POST /api/courses` no longer writes `courses/<courseId>/course.json`
- live `POST /api/courses/[courseId]/lectures` no longer writes `courses/<courseId>/lectures/<lectureId>/lecture.json`
- `GET /api/exams` and `GET /api/exams/[examId]` no longer require `HG_DATA_DIR`
- `GET /api/rubrics`, `GET /api/rubrics/[examId]/[questionId]`, and `POST /api/rubrics` no longer require `HG_DATA_DIR`
- `POST /api/courses` no longer requires `HG_DATA_DIR`
- `LegacyExamRecord.examFilePath` keeps the same relative wire shape, now derived from stored asset bucket/path metadata
- `import:file-backed` now emits compatibility files only when `--emit-compat-files` is passed

## Runtime Result

After Wave 4A:

- live runtime no longer materializes compatibility exam/rubric/course/lecture metadata files
- DB-backed metadata reads work without `HG_DATA_DIR`
- `HG_DATA_DIR` remains required only where local asset bytes are still written or read
- remaining filesystem use is limited to:
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

- `rg "materialize[A-Za-z]+Compatibility" apps/web/src/app/api` returned no matches
- `rg "HG_DATA_DIR" apps/web/src/app/api` showed only asset-byte paths plus the health `dataDir` field
- importer tests now cover:
  - default no compatibility emission
  - explicit `--emit-compat-files`

Manual follow-up not run as part of closure:

- boot web with `DATABASE_URL` and without `HG_DATA_DIR`
- verify DB-backed metadata reads still succeed
- verify `POST /api/rubrics` and `POST /api/courses` still succeed
- verify exam upload and lecture upload still fail loudly without `HG_DATA_DIR`
- restore `HG_DATA_DIR` and confirm exam/lecture creation no longer writes compatibility metadata files

## Next Step

Wave 4B.

That cleanup wave should retire leftover local-store/runtime packaging, remove no-longer-needed compatibility helpers from live code paths, and finish the legacy runtime retirement work that still exists only for rollback, archive, or debug purposes.
