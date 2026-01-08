# Homework Grader - Architecture Report

**Generated:** 2025-01-XX  
**Repo Structure:** pnpm monorepo with TypeScript

---

## 1. Repo Map

### High-Level Structure

```
HomeWork/
├── apps/
│   ├── web/              # Next.js App Router web application
│   │   └── src/
│   │       ├── app/      # Next.js routes (pages + API)
│   │       ├── components/  # React components
│   │       └── lib/      # Server/client helpers
│   │
│   └── worker/           # Node.js TypeScript worker (grading processor)
│       └── src/
│           ├── core/     # Core grading logic
│           ├── lib/      # Worker utilities (heartbeat, job processing)
│           ├── scripts/  # CLI scripts (createJob, runLoop, smoke tests)
│           └── services/ # External service integrations (Gemini API)
│
└── packages/
    ├── shared-schemas/   # Zod schemas + TypeScript types (shared contracts)
    │   └── src/
    │       ├── index.ts  # Legacy EvaluationResult + rubric v1 exports
    │       └── rubric/v1/
    │           ├── schemas.ts    # RubricSpec, RubricEvaluationRaw schemas
    │           ├── errors.ts     # RubricValidationError classes
    │           └── normalize.ts  # normalizeAndValidateRubricEvaluation()
    │
    └── local-job-store/  # File-based job queue (no DB)
        └── src/
            ├── types.ts         # JobRecord, JobStatus types
            ├── fileJobStore.ts  # CRUD operations for jobs
            └── index.ts         # Public API exports
```

**Purpose:**
- **apps/web**: Lecturer-facing UI + API routes for job submission, rubric/exam management
- **apps/worker**: Background worker that processes pending jobs via Gemini API
- **packages/shared-schemas**: Shared contracts (Zod schemas) used by web + worker
- **packages/local-job-store**: File-based job queue implementation (atomic file operations)

---

## 2. Data/Storage Layout (HG_DATA_DIR)

All storage paths are relative to `HG_DATA_DIR` environment variable (must be set, no fallbacks).

### Directory Structure

```
<HG_DATA_DIR>/
├── uploads/                    # Uploaded files (submissions, question images)
│   └── submission_<timestamp>_<random>.<ext>
│   └── question_<timestamp>_<random>.<ext>
│   └── <examBaseName>_<jobId>.<ext>  # Exam files copied per job
│
├── jobs/
│   ├── pending/               # Job JSON files awaiting processing
│   │   └── job-<timestamp>-<random>.json
│   ├── running/              # Currently processing jobs (atomic lock)
│   │   └── job-<timestamp>-<random>.json
│   ├── done/                 # Completed jobs with results
│   │   └── job-<timestamp>-<random>.json
│   └── failed/               # Failed jobs with error messages
│       └── job-<timestamp>-<random>.json
│
├── rubrics/                  # Rubric specifications
│   └── <examId>/
│       └── <questionId>.json  # RubricSpec JSON
│
├── exams/                    # Exam packages
│   └── <examId>/
│       ├── exam.json         # Exam metadata (title, createdAt, examFilePath)
│       └── assets/
│           └── <originalName>_<timestamp>_<random>.<ext>  # Exam PDF/image
│
└── worker/
    └── heartbeat.json        # Worker health heartbeat { ts: ISO, pid: number }
```

### Key Files

- **Job files**: `packages/local-job-store/src/fileJobStore.ts` (lines 31-36)
- **Rubrics**: `apps/web/src/lib/rubrics.ts` (line 9)
- **Exams**: `apps/web/src/lib/exams.ts` (lines 40-50)
- **Heartbeat**: `apps/worker/src/lib/heartbeat.ts`

---

## 3. Core Contracts (Types + Schemas)

### 3.1 JobRecord

**File:** `packages/local-job-store/src/types.ts`

```typescript
type JobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

type JobRecord = {
  id: string;                    // Format: "job-<timestamp>-<random>"
  status: JobStatus;
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  inputs: {
    examFilePath: string;         // Required: path to exam file in uploads/
    questionId: string;           // Required: question identifier
    submissionFilePath: string;   // Required: path to submission file
    questionFilePath?: string;    // Optional: fallback question image
    notes?: string;               // Optional: grading notes
    questionText?: string;       // Legacy (unused)
    referenceSolutionText?: string; // Legacy (unused)
  };
  versions: {
    prompt_version: string;       // "1.0.0"
    rubric_version: string;       // "1.0.0"
    model_version: string;        // "gemini-1.5-pro"
  };
  rubric?: RubricSpec;           // Snapshot of rubric at job creation
  resultJson?: unknown;          // Result shape depends on rubric presence
  errorMessage?: string;         // Set if status === 'FAILED'
};
```

### 3.2 RubricSpec Schema

**File:** `packages/shared-schemas/src/rubric/v1/schemas.ts`

```typescript
type RubricSpec = {
  examId: string;
  questionId: string;
  title?: string;
  generalGuidance?: string;
  criteria: Array<{
    id: string;                  // Stable criterion ID (used for matching)
    label: string;               // Display label
    kind: 'points' | 'binary';  // Scoring type
    maxPoints: number;           // Integer > 0
    guidance?: string;           // Optional guidance text
  }>;                           // Min 1 criterion required
};
```

**Validation:** `RubricSpecSchema` (Zod) enforces structure.

### 3.3 Job Result Shape

**File:** `apps/worker/src/lib/processNextPendingJob.ts` (lines 28-30)

When `job.status === 'DONE'`:

```typescript
job.resultJson = {
  rubricEvaluation: RubricEvaluationResult  // If rubric-based grading
};
```

**RubricEvaluationResult** (`packages/shared-schemas/src/rubric/v1/schemas.ts`):

```typescript
type RubricEvaluationResult = {
  examId: string;
  questionId: string;
  criteria: Array<{
    criterionId: string;
    label: string;
    kind: 'points' | 'binary';
    maxPoints: number;
    score: number;              // Validated against kind (0..maxPoints or {0, maxPoints})
    feedback: string;
    guidance?: string;
  }>;
  sectionScore: number;         // Sum of all criterion scores
  sectionMaxPoints: number;     // Sum of all criterion maxPoints
  overallFeedback?: string;     // Optional overall feedback
};
```

**Errors/Warnings:**
- If `status === 'FAILED'`: `job.errorMessage` contains error string
- Common errors: `QUESTION_NOT_FOUND_IN_EXAM`, rubric validation failures
- Validation errors include error codes: `MISSING_CRITERIA`, `EXTRA_CRITERIA`, `DUPLICATE_CRITERIA`, `INVALID_SCORE_RANGE`, etc.

---

## 4. Web API Endpoints

### 4.1 POST /api/jobs

**File:** `apps/web/src/app/api/jobs/route.ts`

**Purpose:** Create a new grading job.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Fields:
  - `examId` (string, required)
  - `questionId` (string, required)
  - `submission` (File, required)
  - `question` (File, optional - fallback image)
  - `notes` (string, optional)

**Response:**
- `200`: `{ jobId: string }`
- `400`: `{ error: string }` (missing fields)
- `404`: `{ error: string }` (exam/rubric not found)
- `500`: `{ error: string }` (HG_DATA_DIR missing or other errors)

**Flow:**
1. Validates required fields
2. Loads exam from `<HG_DATA_DIR>/exams/<examId>/exam.json`
3. Loads rubric from `<HG_DATA_DIR>/rubrics/<examId>/<questionId>.json`
4. Writes uploaded files to `<HG_DATA_DIR>/uploads/`
5. Creates job via `createJob()` → writes to `pending/`

---

### 4.2 GET /api/jobs/[id]

**File:** `apps/web/src/app/api/jobs/[id]/route.ts`

**Purpose:** Get job status and results.

**Request:**
- Method: `GET`
- Path: `/api/jobs/<jobId>`

**Response:**
- `200`: `{ status: JobStatus, resultJson?: unknown, errorMessage?: string }`
- `404`: `{ error: 'Job not found' }`
- `500`: `{ error: string }` (HG_DATA_DIR missing)

**Note:** Used for polling by UI.

---

### 4.3 POST /api/exams

**File:** `apps/web/src/app/api/exams/route.ts` (lines 11-57)

**Purpose:** Create a new exam package.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Fields:
  - `title` (string, required)
  - `examFile` (File, required - PDF/image)

**Response:**
- `200`: `{ examId: string }` (format: `exam-<timestamp>-<random>`)
- `400`: `{ error: string, code: 'BAD_REQUEST' }`
- `500`: `{ error: string, code: 'HG_DATA_DIR_MISSING' | 'INTERNAL_ERROR' }`

**Storage:**
- Creates `<HG_DATA_DIR>/exams/<examId>/exam.json` (metadata)
- Stores file in `<HG_DATA_DIR>/exams/<examId>/assets/<name>_<timestamp>_<random>.<ext>`

---

### 4.4 GET /api/exams

**File:** `apps/web/src/app/api/exams/route.ts` (lines 63-84)

**Purpose:** List all exams.

**Request:**
- Method: `GET`

**Response:**
- `200`: `Array<{ examId: string, title: string, createdAt: string, updatedAt: string, examFilePath: string }>`
- `500`: `{ error: string, code: 'HG_DATA_DIR_MISSING' | 'INTERNAL_ERROR' }`

**Sorting:** By `createdAt` descending (handled in `apps/web/src/lib/exams.ts`).

---

### 4.5 GET /api/exams/[examId]

**File:** `apps/web/src/app/api/exams/[examId]/route.ts`

**Purpose:** Get a single exam by ID.

**Request:**
- Method: `GET`
- Path: `/api/exams/<examId>`

**Response:**
- `200`: `{ examId: string, title: string, createdAt: string, updatedAt: string, examFilePath: string }`
- `404`: `{ error: string, code: 'EXAM_NOT_FOUND' }`
- `500`: `{ error: string, code: 'HG_DATA_DIR_MISSING' | 'INTERNAL_ERROR' }`

---

### 4.6 POST /api/rubrics

**File:** `apps/web/src/app/api/rubrics/route.ts` (lines 71-118)

**Purpose:** Create or update a rubric.

**Request:**
- Method: `POST`
- Content-Type: `application/json`
- Body: `RubricSpec` JSON

**Response:**
- `200`: `{ ok: true }`
- `400`: `{ error: string }` (validation failed)
- `500`: `{ error: string }` (HG_DATA_DIR missing or write error)

**Storage:**
- Writes atomically to `<HG_DATA_DIR>/rubrics/<examId>/<questionId>.json`
- Uses temp file + rename for atomicity.

---

### 4.7 GET /api/rubrics?examId=<id>

**File:** `apps/web/src/app/api/rubrics/route.ts` (lines 32-64)

**Purpose:** List question IDs for an exam.

**Request:**
- Method: `GET`
- Query: `?examId=<examId>`

**Response:**
- `200`: `{ ok: true, data: { questionIds: string[] } }`
- `400`: `{ ok: false, error: 'examId is required' }`
- `500`: `{ ok: false, error: string }`

**Behavior:** Scans `<HG_DATA_DIR>/rubrics/<examId>/*.json`, extracts questionId from filenames. Returns empty array if directory doesn't exist.

---

### 4.8 GET /api/rubrics/[examId]/[questionId]

**File:** `apps/web/src/app/api/rubrics/[examId]/[questionId]/route.ts`

**Purpose:** Retrieve a rubric by examId and questionId.

**Request:**
- Method: `GET`
- Path: `/api/rubrics/<examId>/<questionId>`

**Response:**
- `200`: `RubricSpec` JSON
- `404`: `{ error: 'Rubric not found' }`
- `500`: `{ error: string }`

---

### 4.9 GET /api/health

**File:** `apps/web/src/app/api/health/route.ts`

**Purpose:** Check worker health status.

**Request:**
- Method: `GET`

**Response:**
- `200`: `{ ok: true, dataDir: string, workerAlive: boolean, heartbeatAgeMs: number | null }`
- `500`: `{ error: string }`

**Logic:** Reads `<HG_DATA_DIR>/worker/heartbeat.json`, computes age. Worker considered alive if heartbeat < 10 seconds old.

---

## 5. UI Pages

### 5.1 / (Home)

**File:** `apps/web/src/app/page.tsx`

**Purpose:** Main job submission UI + results display.

**Features:**
- Form for job submission:
  - Exam dropdown (loads from `/api/exams`)
  - Question ID input (with datalist for existing questions)
  - Submission file upload (required)
  - Optional question image upload (fallback)
  - Notes textarea
- Job status polling (every 2 seconds)
- Results display:
  - If `rubricEvaluation` exists: Shows rubric table with criteria scores
  - Legacy fallback: Shows `score_total`, `confidence`, `summary_feedback`
- Worker health banner (polls `/api/health` every 7 seconds)
- "Start New Grading" button (resets form)

**Components Used:**
- `RubricCriterionRow` (`apps/web/src/components/RubricCriterionRow.tsx`) - Renders single criterion row

---

### 5.2 /exams

**File:** `apps/web/src/app/exams/page.tsx`

**Purpose:** Exam management UI.

**Features:**
- "Create Exam" form:
  - Title input
  - Exam file upload (PDF/image)
  - Create button
- "Existing Exams" list:
  - Displays examId, title, createdAt (formatted)
  - Sorted by createdAt descending
- Success/error banners
- Link back to home

**Client Helper:** `apps/web/src/lib/examsClient.ts` (`listExams()`, `createExam()`)

---

### 5.3 /rubrics

**File:** `apps/web/src/app/rubrics/page.tsx`

**Purpose:** Rubric editor UI.

**Features:**
- Exam dropdown (loads exams, sets `examId`)
- Question ID selection (datalist + text input hybrid)
  - Auto-loads existing rubric when examId + questionId set (300ms debounce)
  - Shows "No rubric yet" message if 404
- Criteria editor:
  - Add/remove criteria rows
  - Each row: id (auto-generated), label, kind (dropdown), maxPoints, guidance
  - Real-time validation (label required, maxPoints > 0)
  - Shows total max points
- Load/Save buttons:
  - Load: GET `/api/rubrics/<examId>/<questionId>`
  - Save: POST `/api/rubrics` with RubricSpec JSON
- Navigation links: "Manage Exams" → `/exams`, "Back to Home" → `/`

**Client Helper:** `apps/web/src/lib/rubricsClient.ts` (`listRubricQuestionIds()`)

---

### 5.4 Job Status/Result Page

**Status:** No dedicated route. Results are displayed inline on `/` after job completion.

---

## 6. Worker Pipeline Summary

### 6.1 Entry Point

**File:** `apps/worker/src/scripts/runLoop.ts`

**Flow:**
1. Loads `.env` from repo root
2. Calls `ensureJobDirs()`
3. Enters loop:
   - Updates heartbeat every 2 seconds (`apps/worker/src/lib/heartbeat.ts`)
   - Calls `processNextPendingJob()`
   - If job processed → continue immediately
   - If no job → sleep 1 second
4. Handles graceful shutdown (SIGINT/SIGTERM)

---

### 6.2 Job Claiming

**File:** `packages/local-job-store/src/fileJobStore.ts` (lines 141-184)

**Function:** `claimNextPendingJob()`

**Process:**
1. Lists files in `pending/` directory
2. Sorts by `mtime` (oldest first)
3. Atomically renames `pending/<jobId>.json` → `running/<jobId>.json` (this is the lock)
4. Updates job status to `RUNNING`, updates `updatedAt`
5. Writes updated job back to `running/`
6. Returns `JobRecord`

**Atomicity:** File rename is atomic on most filesystems, preventing race conditions.

---

### 6.3 Prompt/Parts Building

**File:** `apps/worker/src/core/gradeSubmission.ts` (lines 47-160)

**Function:** `gradeSubmission(job: JobRecord)`

**Process:**
1. Reads exam file (`job.inputs.examFilePath`) → converts to base64
2. Reads submission file (`job.inputs.submissionFilePath`) → converts to base64
3. Reads optional question image (`job.inputs.questionFilePath`) → converts to base64 (if exists)
4. Builds prompt (lines 107-147):
   - Instructs to grade ONLY `questionId` from exam
   - Includes rubric details (title, generalGuidance, criteria list)
   - Specifies JSON output format (`RubricEvaluationRawSchema`)
   - Includes error handling for `QUESTION_NOT_FOUND_IN_EXAM`
   - Adds `job.inputs.notes` if present
5. Builds `parts` array:
   ```typescript
   [
     { text: prompt },
     { inlineData: { data: examBase64, mimeType: examMimeType } },
     { inlineData: { data: submissionBase64, mimeType: submissionMimeType } },
     // Optional:
     { inlineData: { data: questionBase64, mimeType: questionMimeType } }
   ]
   ```

---

### 6.4 Gemini API Call

**File:** `apps/worker/src/core/gradeSubmission.ts` (lines 149-168)

**Process:**
1. Creates `GeminiService` instance
2. Calls `geminiService.generateFromParts(parts)`
3. **GeminiService** (`apps/worker/src/services/geminiService.ts`, lines 96-110):
   - Gets model from `process.env.GEMINI_MODEL` (default: `gemini-3-pro-preview`)
   - Calls `model.generateContent({ contents: [{ role: 'user', parts }] })`
   - Returns `response.text()`
4. Parses JSON robustly:
   - Strips markdown code fences (```json, ```)
   - Extracts substring from first `{` to last `}`
   - `JSON.parse()`
5. Checks for `QUESTION_NOT_FOUND_IN_EXAM` error in parsed JSON
6. Throws if parsing fails (includes preview of raw output)

---

### 6.5 Normalize/Validate

**File:** `apps/worker/src/core/gradeSubmission.ts` (lines 188-207)

**Process:**
1. Validates against `RubricEvaluationRawSchema` (Zod):
   - Ensures structure matches: `{ examId, questionId, criteria[], overallFeedback? }`
   - Throws if validation fails
2. Calls `normalizeAndValidateRubricEvaluation(rubric, rawEvaluation)`:
   - **File:** `packages/shared-schemas/src/rubric/v1/normalize.ts`
   - Validates `examId`/`questionId` match rubric
   - Enforces strict criterion matching:
     - No missing criteria (all rubric criteria must be present)
     - No extra criteria (no criteria outside rubric)
     - No duplicate criterion IDs
   - Validates scores:
     - `points`: `0 <= score <= maxPoints`
     - `binary`: `score in {0, maxPoints}`
   - Injects rubric fields (`label`, `kind`, `maxPoints`, `guidance`) into output
   - Computes `sectionScore` and `sectionMaxPoints`
   - Returns `RubricEvaluationResult`
3. Throws `RubricValidationError` with specific error codes on failure

---

### 6.6 Job Completion/Failure

**File:** `apps/worker/src/lib/processNextPendingJob.ts` (lines 13-43)

**Process:**
1. If `gradeSubmission()` succeeds:
   - Wraps result: `{ rubricEvaluation: gradeResult.result }`
   - Calls `completeJob(jobId, resultJson)`:
     - **File:** `packages/local-job-store/src/fileJobStore.ts` (lines 189-202)
     - Reads job from `running/<jobId>.json`
     - Updates: `status = 'DONE'`, `updatedAt`, `resultJson`
     - Writes to `done/<jobId>.json`
     - Deletes `running/<jobId>.json`
2. If `gradeSubmission()` throws:
   - Extracts error message
   - Calls `failJob(jobId, errorMessage)`:
     - **File:** `packages/local-job-store/src/fileJobStore.ts` (lines 207-220)
     - Reads job from `running/<jobId>.json`
     - Updates: `status = 'FAILED'`, `updatedAt`, `errorMessage`
     - Writes to `failed/<jobId>.json`
     - Deletes `running/<jobId>.json`

---

## 7. Where to Add New Feature X: Review/Annotations

### Suggested Architecture for Review/Annotations Feature

**Goal:** Allow lecturers to review AI-graded results and add annotations/comments.

### 7.1 Data Storage

**New Path:** `<HG_DATA_DIR>/reviews/<jobId>.json`

**Schema (suggested):**
```typescript
type ReviewRecord = {
  jobId: string;
  reviewerId?: string;        // Future: multi-user support
  createdAt: string;
  updatedAt: string;
  annotations: Array<{
    criterionId: string;     // Links to rubric criterion
    comment: string;
    overrideScore?: number;   // Optional score override
  }>;
  overallComment?: string;
  status: 'draft' | 'approved' | 'rejected';
};
```

**File:** Create `apps/web/src/lib/reviews.ts` (similar to `exams.ts`, `rubrics.ts`)

---

### 7.2 API Endpoints

**Create:** `apps/web/src/app/api/reviews/[jobId]/route.ts`

- **POST**: Create/update review
  - Body: `{ annotations: [...], overallComment?: string, status: 'draft' | 'approved' | 'rejected' }`
  - Response: `{ ok: true, reviewId: string }`
- **GET**: Retrieve review
  - Response: `ReviewRecord` or 404

**List:** `apps/web/src/app/api/reviews/route.ts`

- **GET**: List reviews (with filters: `?jobId=...`, `?status=...`)
  - Response: `{ ok: true, data: ReviewRecord[] }`

---

### 7.3 UI Pages

**Option A: Inline on Home Page**
- Add "Review" section below results table
- Show annotations editor when job is DONE
- Save to `/api/reviews/<jobId>`

**Option B: Dedicated Page**
- Create `apps/web/src/app/reviews/[jobId]/page.tsx`
- Full-page review editor
- Link from home page results: "Review this grading"

**Recommendation:** Start with Option A (inline), migrate to Option B if complexity grows.

---

### 7.4 Schema Updates

**File:** `packages/shared-schemas/src/index.ts` or new `packages/shared-schemas/src/review/v1/schemas.ts`

- Add `ReviewRecordSchema` (Zod)
- Export types for web + worker (if worker needs to read reviews)

---

### 7.5 Worker Integration (Optional)

If reviews should affect future grading:

- **File:** `apps/worker/src/core/gradeSubmission.ts`
- Load review for similar submissions (if exists)
- Include review annotations in prompt as "previous feedback examples"

**Recommendation:** Keep reviews separate initially (post-processing), add worker integration later if needed.

---

### 7.6 Summary: Files to Create/Modify

**New Files:**
1. `apps/web/src/lib/reviews.ts` - Review storage helpers
2. `apps/web/src/app/api/reviews/[jobId]/route.ts` - Review CRUD API
3. `apps/web/src/app/api/reviews/route.ts` - List reviews API
4. `apps/web/src/components/ReviewEditor.tsx` - Review UI component (optional)
5. `packages/shared-schemas/src/review/v1/schemas.ts` - Review schemas (if shared)

**Modify:**
1. `apps/web/src/app/page.tsx` - Add review section below results
2. `packages/shared-schemas/src/index.ts` - Export review schemas (if created)

**No Changes Needed:**
- Worker pipeline (reviews are post-processing)
- Job store (reviews are separate entities)

---

## Appendix: Key File Paths Reference

| Component | File Path |
|-----------|-----------|
| Job types | `packages/local-job-store/src/types.ts` |
| Job storage | `packages/local-job-store/src/fileJobStore.ts` |
| Rubric schemas | `packages/shared-schemas/src/rubric/v1/schemas.ts` |
| Rubric normalization | `packages/shared-schemas/src/rubric/v1/normalize.ts` |
| Grading logic | `apps/worker/src/core/gradeSubmission.ts` |
| Worker loop | `apps/worker/src/scripts/runLoop.ts` |
| Job processing | `apps/worker/src/lib/processNextPendingJob.ts` |
| Gemini service | `apps/worker/src/services/geminiService.ts` |
| Home page | `apps/web/src/app/page.tsx` |
| Jobs API | `apps/web/src/app/api/jobs/route.ts` |
| Exams API | `apps/web/src/app/api/exams/route.ts` |
| Rubrics API | `apps/web/src/app/api/rubrics/route.ts` |
| Health API | `apps/web/src/app/api/health/route.ts` |

---

**End of Report**

