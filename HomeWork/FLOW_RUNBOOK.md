# Homework Grader Flow Runbook

Last updated: 2026-02-22

This file is the quick reference for how the system works end-to-end.

## Short answer: "When does exam split happen?"

Exam splitting into top-level questions now runs **automatically right after exam upload** at `/exams`.

How it works:

1. Exam file and metadata are saved.
2. API immediately triggers:
   - `pnpm --filter worker exam:index -- --examId <EXAM_ID>`
3. If indexing succeeds:
   - `data/exams/<examId>/examIndex.json` is created.
4. If indexing fails:
   - exam is still created,
   - UI shows warning with the manual command.

## End-to-end flow

### 1) Create Exam

UI: `/exams`

What is saved:
- Exam file under `data/exams/<examId>/assets/...`
- Metadata file `data/exams/<examId>/exam.json`
- Auto-index attempt runs immediately after save.

What does NOT happen:
- No student grading yet
- No review generation yet

### 2) Build/Repair Exam Index (manual fallback)

Command:

```powershell
pnpm --filter worker exam:index -- --examId <EXAM_ID>
```

What it does:
- Reads the exam file.
- Uses Gemini to extract top-level questions (`q1`, `q2`, ...).
- Stores `examIndex.json` with question labels, aliases, and prompt text.

Result:
- GENERAL DOCUMENT grading can iterate over real questions.

### 3) Create Grading Job

UI: `/` (Create Grading Job)

Important modes:

1. `RUBRIC`:
   - Uses one `questionId` per job.
   - Requires rubric for that question.
   - No full-document split inside that single job.

2. `GENERAL` + `QUESTION`:
   - Evaluates one question.

3. `GENERAL` + `DOCUMENT`:
   - Full exam path.
   - Worker tries to process all questions (from examIndex first).

### 4) Worker Processing

Worker entry:

```powershell
pnpm --filter worker job:run-loop
```

or single run:

```powershell
pnpm --filter worker job:run-once
```

For `GENERAL + DOCUMENT`, worker behavior:

1. Resolve `examId`.
2. Build question list:
   - `examIndex.questions` if present.
   - else rubric question IDs.
   - else single `DOCUMENT`.
3. For each question:
   - Map relevant pages from submission.
   - Extract mini-PDF if mapping exists.
   - Evaluate findings with Gemini.
4. Localize findings into annotations.
5. Save result to job and review store.

### 5) Review

UI pages:
- `/reviews` all jobs list
- `/reviews/[jobId]` detailed review (PDF/image overlays + findings)

## Recommended "full exam" recipe

1. Upload exam at `/exams`.
2. Confirm indexing succeeded in the upload message.
3. If indexing failed, run:

```powershell
pnpm --filter worker exam:index -- --examId <EXAM_ID>
```

4. Start web + worker.
5. Create job from `/` with:
   - `Grading Mode = GENERAL`
   - `Scope = DOCUMENT`
   - submission PDF
6. Open `/reviews/<JOB_ID>`.

## Fast diagnostics

1. Worker health:

```powershell
curl.exe http://localhost:3000/api/health
```

2. Job status:

```powershell
curl.exe http://localhost:3000/api/jobs/<JOB_ID>
```

3. Reviews list:

```powershell
curl.exe http://localhost:3000/api/reviews
```

4. If logs show:
   - `No examIndex or rubrics for examId=..., using DOCUMENT scope`
   - Then no real per-question split was available.

## Key code paths

- Exam creation API: `apps/web/src/app/api/exams/route.ts`
- Create exam storage: `apps/web/src/lib/exams.ts`
- Job creation API: `apps/web/src/app/api/jobs/route.ts`
- Worker dispatcher: `apps/worker/src/lib/processNextPendingJob.ts`
- General per-question evaluation: `apps/worker/src/core/generalEvaluatePerQuestion.ts`
- Exam index generator: `apps/worker/src/scripts/generateExamIndex.ts`
