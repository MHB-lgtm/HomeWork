# Homework Grader Architecture (Current)

Last updated: 2026-02-22
Scope: current implementation in this repository (not planned/future behavior)

## 1. Product Focus Right Now

The current product priority is:

- Lecturer uploads an exam file once.
- Lecturer uploads student submission(s).
- System grades with minimal setup.
- Course RAG/study pointers are optional and non-blocking.

This document reflects that priority and the latest implementation.

## 2. Monorepo Structure

```text
HomeWork/
|-- apps/
|   |-- web/                     # Next.js app (UI + API)
|   `-- worker/                  # Background grading worker + scripts
|-- packages/
|   |-- shared-schemas/          # Shared Zod schemas + TS types
|   |-- local-job-store/         # File-based jobs, reviews, examIndex store
|   `-- local-course-store/      # File-based courses, lectures, RAG index
|-- data/                        # Runtime data root (via HG_DATA_DIR)
|-- scripts/
|   `-- presentation-smoke.ps1   # End-to-end smoke script
`-- .env
```

## 3. Runtime Components

### 3.1 Web App (`apps/web`)

- Next.js App Router UI pages (`/`, `/exams`, `/rubrics`, `/reviews`, `/courses`).
- API routes under `apps/web/src/app/api/*`.
- Handles exam creation, job creation, review read/write, and course/RAG APIs.

### 3.2 Worker (`apps/worker`)

- Consumes jobs from file queue.
- Executes grading pipeline (RUBRIC or GENERAL).
- Writes results and annotations.
- Optionally attaches study pointers (best-effort).

Important:

- Actual worker loop command is `pnpm --filter worker job:run-loop`.
- Single pass command is `pnpm --filter worker job:run-once`.
- `pnpm --filter worker start` currently runs `dist/index.js` (contract smoke), not the queue loop.

### 3.3 Shared Packages

- `packages/shared-schemas`: canonical contracts (`RubricSpec`, `GeneralEvaluation`, `ExamIndex`, `ReviewRecord`, course/RAG schemas).
- `packages/local-job-store`: queue state transitions, review storage, examIndex storage.
- `packages/local-course-store`: course + lecture + lexical RAG index.

### 3.4 External Dependency

- Gemini API via `apps/worker/src/services/geminiService.ts`.
- Model defaults to `GEMINI_MODEL` env var or `gemini-3-pro-preview`.

## 4. Environment and Storage

### 4.1 Required Environment Variables

- `HG_DATA_DIR`: required for all file-backed storage.
- `GEMINI_API_KEY`: required for Gemini calls.
- `GEMINI_MODEL`: optional override.

### 4.2 Data Layout Under `HG_DATA_DIR`

```text
<HG_DATA_DIR>/
|-- uploads/
|   |-- <copied files used by jobs>
|   `-- derived/
|       `-- <jobId>/questions/<questionId>.pdf      # mini-PDF per question
|-- jobs/
|   |-- pending/
|   |-- running/
|   |-- done/
|   `-- failed/
|-- reviews/
|   `-- <jobId>.json
|-- exams/
|   `-- <examId>/
|       |-- exam.json
|       |-- examIndex.json
|       `-- assets/<uploaded exam file>
|-- rubrics/
|   `-- <examId>/<questionId>.json
|-- courses/
|   `-- <courseId>/
|       |-- course.json
|       |-- lectures/<lectureId>/...
|       `-- rag/v1/{manifest.json,chunks.jsonl}
`-- worker/heartbeat.json
```

### 4.3 Job Queue Semantics

Implemented in `packages/local-job-store/src/fileJobStore.ts`:

- Create job -> write JSON to `jobs/pending`.
- Claim job -> atomic rename `pending -> running`.
- Success -> write final JSON in `done`, delete from `running`.
- Failure -> write final JSON in `failed`, delete from `running`.

## 5. Core Contracts

### 5.1 JobRecord

File: `packages/local-job-store/src/types.ts`

Key inputs:

- `courseId?`
- `examId?` (now set by web API; fallback inference still exists in worker)
- `examFilePath`
- `questionId` (empty string allowed for `GENERAL + DOCUMENT`)
- `submissionFilePath`
- `submissionMimeType?`
- `questionFilePath?`
- `gradingMode?: 'RUBRIC' | 'GENERAL'`
- `gradingScope?: 'QUESTION' | 'DOCUMENT'`

### 5.2 ExamIndex

File: `packages/shared-schemas/src/exam-index/v1/schemas.ts`

- `examId`
- `status: 'proposed' | 'confirmed'`
- `questions[]` each with:
- `id` (`q1`, `q2`, ...)
- `order` (contiguous 1..N)
- `displayLabel`
- `aliases[]`
- `promptText` (required, max 800 chars)

### 5.3 General Evaluation

File: `packages/shared-schemas/src/general/v1/schemas.ts`

Supports:

- Legacy: top-level `findings[]`
- Current preferred: `questions[]` with per-question findings, optional `pageIndices`, optional `mappingConfidence`

### 5.4 ReviewRecord

File: `packages/shared-schemas/src/review/v1/schemas.ts`

- `jobId`
- `annotations[]` (bbox normalized, `pageIndex`, `status`, metadata)

## 6. Web API Surface (Current)

### 6.1 Exams

- `POST /api/exams` -> create exam, then auto-trigger exam indexing.
- `GET /api/exams` -> list exams.
- `GET /api/exams/[examId]` -> fetch exam metadata.
- `GET /api/exams/[examId]/index` -> fetch examIndex (or `null`).
- `PUT /api/exams/[examId]/index` -> update examIndex manually.

### 6.2 Jobs

- `POST /api/jobs` -> create grading job.
- `GET /api/jobs/[id]` -> status/result/error + mode/scope + submission mime.
- `GET /api/jobs/[id]/submission` -> image-only view endpoint (PNG/JPG/JPEG).
- `GET /api/jobs/[id]/submission-raw` -> raw submission (PDF or image).

### 6.3 Rubrics

- `GET /api/rubrics?examId=<id>` -> list rubric question IDs.
- `POST /api/rubrics` -> create/update rubric.
- `GET /api/rubrics/[examId]/[questionId]` -> fetch rubric.

### 6.4 Reviews

- `GET /api/reviews` -> list review summaries.
- `GET /api/reviews/[jobId]` -> get review (creates empty record if missing).
- `PUT /api/reviews/[jobId]` -> save review.

### 6.5 Courses and RAG (Optional Path)

- `GET/POST /api/courses`
- `GET /api/courses/[courseId]`
- `GET/POST /api/courses/[courseId]/lectures`
- `POST /api/courses/[courseId]/rag/rebuild`
- `GET /api/courses/[courseId]/rag/manifest`
- `POST /api/courses/[courseId]/rag/query`
- `POST /api/courses/[courseId]/rag/suggest`

### 6.6 Health

- `GET /api/health` -> reads `worker/heartbeat.json`, worker considered alive if heartbeat age < 10s.

## 7. End-to-End Flows

### 7.1 Exam Upload and Auto-Index (Latest)

Main code:

- `apps/web/src/app/api/exams/route.ts`
- `apps/web/src/lib/exams.ts`
- `apps/worker/src/scripts/generateExamIndex.ts`

Flow:

1. Lecturer uploads exam in `/exams`.
2. API saves exam file + `exam.json`.
3. API immediately runs:
- `pnpm --filter worker exam:index -- --examId <examId>`
4. Indexing result returned in API response (`indexing.ok`, `indexing.message`, `details?`).
5. UI shows success/warning based on indexing outcome.

Current behavior details:

- Auto-index runs inside request lifecycle with 3-minute timeout.
- Exam creation succeeds even if indexing fails.

### 7.2 Job Creation

Main code: `apps/web/src/app/api/jobs/route.ts`

Flow:

1. Validate form (`examId`, submission, mode/scope, question requirements).
2. Resolve exam metadata via `getExam`.
3. Load rubric only when `gradingMode='RUBRIC'`.
4. Write upload(s) under `HG_DATA_DIR/uploads`.
5. Call `createJob` in local-job-store.

Important storage note:

- API writes submission file once.
- `createJob` then copies exam/submission into canonical job upload names.

### 7.3 Worker Dispatch

Main code: `apps/worker/src/lib/processNextPendingJob.ts`

Flow:

1. Claim oldest pending job.
2. Branch by `gradingMode`.
3. Produce `resultJson`.
4. Save review annotations.
5. Attach study pointers (best-effort).
6. Complete job or fail job.

### 7.4 RUBRIC Mode

Main code:

- `apps/worker/src/core/gradeSubmission.ts`
- `apps/worker/src/core/localizeMistakes.ts`

Flow:

1. Gemini grades one question against rubric criteria.
2. Localization runs for rubric misses.
3. Annotations saved to review.

### 7.5 GENERAL Mode (Current Core)

Main code:

- `apps/worker/src/core/generalEvaluatePerQuestion.ts`
- `apps/worker/src/core/loadExamIndex.ts`
- `apps/worker/src/core/mapQuestionPages.ts`
- `apps/worker/src/core/extractMiniPdf.ts`
- `apps/worker/src/core/localizeFindingsPerQuestion.ts`

Flow for `GENERAL + DOCUMENT`:

1. Resolve `examId` (prefer `job.inputs.examId`, fallback infer from `examFilePath`).
2. Build question list in this order:
- `examIndex.questions` if present.
- Else rubric question IDs (`rubrics/<examId>/*.json`).
- Else single synthetic `DOCUMENT` question.
3. For each question:
- Map answer pages (`mapQuestionPages`), using full exam file + full submission file.
- Try extracting mini-PDF pages.
- Evaluate findings for that question (again with exam file + mini/original submission).
- Localize finding boxes.
4. Aggregate all question evaluations and annotations.

Flow for `GENERAL + QUESTION`:

- Evaluates only the provided `questionId`.

## 8. ExamIndex Usage Semantics

`examIndex` is the key to reliable per-question document grading.

What it enables:

- Stable question set (`q1..qN`).
- Better page mapping context (`displayLabel`, `aliases`, `promptText`).
- Stronger "focus only this question" prompts.

What happens without it:

- Fallback to rubric question IDs (less context).
- If no rubrics either -> single `DOCUMENT` evaluation (no real split).

It does not replace the exam file:

- Worker still attaches the exam file in Gemini calls that require exam context.

## 9. AI Call Model and Context

Gemini calls are stateless across requests.

Meaning:

- Model does not persist prior request context.
- System re-attaches required files each call.

Current GENERAL+DOCUMENT pattern per question:

- 1 mapping call (exam + full submission)
- 1 evaluation call (exam + mini/original submission)
- 1 localization call (submission side, often mini/original only)

Total calls scale with number of questions.

## 10. Reviews and UI

### 10.1 Main Pages

- `/` -> centered single-column dashboard with:
- Create Grading Job
- How grading works
- System snapshot
- `/exams` -> exam upload + list + indexing feedback
- `/rubrics` -> rubric management
- `/reviews` -> all reviews list
- `/reviews/[jobId]` -> detailed review viewer with PDF/image overlays
- `/courses` and `/courses/[courseId]` -> optional course assistant tooling

### 10.2 Review Viewer Highlights

Main code: `apps/web/src/app/reviews/[jobId]/page.tsx`

- Supports RUBRIC and GENERAL result rendering.
- Uses `submission-raw` endpoint for PDFs.
- Status badges mapped to real job statuses (`PENDING`, `RUNNING`, `DONE`, `FAILED`).
- Shows study pointers when attached.

## 11. Optional Course Assistant (Non-Blocking)

Main code:

- `packages/local-course-store/src/fileCourseRagIndex.ts`
- `apps/worker/src/core/attachStudyPointers.ts`

Behavior:

- If `courseId` exists, worker tries to attach pointers.
- Missing index (`IndexNotBuiltError`) or missing course does not fail the job.
- Core grading remains independent from RAG.

## 12. Recent Changes Incorporated Here

### 12.1 Auto-index after exam upload

- `apps/web/src/app/api/exams/route.ts` now triggers worker exam indexing immediately.
- `apps/web/src/app/exams/page.tsx` surfaces indexing success/warning.
- `apps/web/src/lib/examsClient.ts` returns indexing payload.

### 12.2 Review stability and demo readiness

- `/reviews` list page is active and wired to `GET /api/reviews`.
- `/reviews/[jobId]` status badge logic aligned with real statuses.
- `scripts/presentation-smoke.ps1` added for repeatable end-to-end smoke run.

## 13. Operational Commands

### 13.1 Start Services

```powershell
pnpm --filter web dev
pnpm --filter worker job:run-loop
```

### 13.2 One-time Worker Run

```powershell
pnpm --filter worker job:run-once
```

### 13.3 Manual Exam Index Build

```powershell
pnpm --filter worker exam:index -- --examId <EXAM_ID>
```

### 13.4 Health and Status Checks

```powershell
curl.exe http://localhost:3000/api/health
curl.exe http://localhost:3000/api/jobs/<JOB_ID>
curl.exe http://localhost:3000/api/reviews
```

### 13.5 Smoke Script

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/presentation-smoke.ps1
```

## 14. Known Limitations and Risks

- Auto-index currently runs inside `POST /api/exams` request; long indexing can delay response.
- GENERAL mapping re-sends full exam and submission per question (latency/cost scale with question count).
- `/api/jobs/[id]/submission` is image-only; PDFs must use `/submission-raw`.
- If examIndex and rubrics are both missing, GENERAL DOCUMENT falls back to single `DOCUMENT` pass.
- Worker `start` script does not run queue loop; operational docs should use `job:run-loop`.

## 15. Active vs Legacy Paths

Active grading paths:

- `gradeSubmission` (RUBRIC)
- `generalEvaluatePerQuestion` (GENERAL)
- `localizeMistakes` and `localizeFindingsPerQuestion`

Legacy/backward-compatible code still present:

- `apps/worker/src/core/generalEvaluateSubmission.ts`
- `apps/worker/src/core/localizeFindings.ts`

These are not the primary runtime path in `processNextPendingJob`.
