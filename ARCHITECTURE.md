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
│           ├── core/     # Core grading logic + localization
│           ├── lib/      # Worker utilities (heartbeat, job processing)
│           ├── scripts/  # CLI scripts (createJob, runLoop, smoke tests)
│           └── services/ # External service integrations (Gemini API)
│
└── packages/
    ├── shared-schemas/   # Zod schemas + TypeScript types (shared contracts)
    │   └── src/
    │       ├── index.ts  # Legacy EvaluationResult + rubric v1 + review v1 exports
    │       ├── rubric/v1/
    │       │   ├── schemas.ts    # RubricSpec, RubricEvaluationRaw schemas
    │       │   ├── errors.ts     # RubricValidationError classes
    │       │   └── normalize.ts  # normalizeAndValidateRubricEvaluation()
    │       └── review/v1/
    │           └── schemas.ts    # ReviewRecord, Annotation, BBoxNorm schemas
    │
    └── local-job-store/  # File-based job queue (no DB)
        └── src/
            ├── types.ts         # JobRecord, JobStatus types
            ├── fileJobStore.ts  # CRUD operations for jobs
            ├── fileReviewStore.ts  # CRUD operations for reviews
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
├── uploads/                    # Uploaded files (submissions, question images, exam copies)
│   ├── submission_<timestamp>_<random>.<ext>
│   ├── question_<timestamp>_<random>.<ext>
│   ├── <examBaseName>_<jobId>.<ext>  # Exam files copied per job
│   └── derived/               # Derived assets (mini-PDFs for per-question evaluation)
│       └── <jobId>/
│           └── questions/
│               └── <questionId>.pdf  # Mini-PDFs extracted during GENERAL mode
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
│       ├── examIndex.json    # ExamIndex v1 (question mapping, optional)
│       └── assets/
│           └── <originalName>_<timestamp>_<random>.<ext>  # Exam PDF/image
│
├── reviews/                  # Review annotations (AI-generated + human edits)
│   └── <jobId>.json          # ReviewRecord v1 with annotations (bboxNorm)
│
└── worker/
    └── heartbeat.json        # Worker health heartbeat { ts: ISO, pid: number }
```

### Key Files

- **Job files**: `packages/local-job-store/src/fileJobStore.ts` (lines 31-36)
- **Rubrics**: `apps/web/src/lib/rubrics.ts` (line 9)
- **Exams**: `apps/web/src/lib/exams.ts` (lines 40-50)
- **Reviews**: `packages/local-job-store/src/fileReviewStore.ts`
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
    examId?: string;              // Required going forward; optional for backward compatibility
    examFilePath: string;         // Required: path to exam file in uploads/ (copied from exams/<examId>/assets/)
    questionId: string;           // Required: question identifier (can be empty string for GENERAL + DOCUMENT scope)
    submissionFilePath: string;   // Required: path to submission file
    submissionMimeType?: string;   // Optional: explicit MIME type (image/png, application/pdf, etc.)
    questionFilePath?: string;    // Optional: fallback question image
    notes?: string;               // Optional: grading notes
    gradingMode?: 'RUBRIC' | 'GENERAL';  // Default: 'RUBRIC'
    gradingScope?: 'QUESTION' | 'DOCUMENT';  // Default: 'QUESTION' (only for GENERAL mode)
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

### 3.4 ReviewRecord Schema (v1)

**File:** `packages/shared-schemas/src/review/v1/schemas.ts`

```typescript
type BBoxNorm = {
  x: number;  // 0..1, top-left corner X
  y: number;  // 0..1, top-left corner Y
  w: number;  // 0..1, width (must be > 0)
  h: number;  // 0..1, height (must be > 0)
};

type Annotation = {
  id: string;                    // Format: "ai-<criterionId>-<timestamp>-<random>"
  criterionId: string;           // Links to rubric criterion
  pageIndex: number;             // 0 for PNG/JPG, >0 for PDF pages
  bboxNorm: BBoxNorm;            // Normalized bounding box coordinates
  label?: string;                 // Optional short label
  comment?: string;               // Optional explanation
  createdBy: 'human' | 'ai';      // Source of annotation
  confidence?: number;            // 0..1, AI confidence level
  status: 'proposed' | 'confirmed' | 'rejected';
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp
};

type ReviewRecord = {
  version: '1.0.0';
  jobId: string;
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  annotations: Annotation[];     // Array of annotations (can be empty)
};
```

**Storage:** `<HG_DATA_DIR>/reviews/<jobId>.json`

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

### 4.10 GET /api/jobs/[id]/submission

**File:** `apps/web/src/app/api/jobs/[id]/submission/route.ts`

**Purpose:** Get the submission image file for a job (PNG/JPG only).

**Request:**
- Method: `GET`
- Path: `/api/jobs/<jobId>/submission`

**Response:**
- `200`: Raw image bytes (PNG/JPG only)
- `404`: `{ error: string }` (job not found or file missing)
- `415`: `{ error: 'Submission review supports PNG/JPG only for now.' }` (unsupported format)
- `500`: `{ error: string }` (HG_DATA_DIR missing)

**Headers:**
- `Content-Type`: `image/png` or `image/jpeg`
- `Cache-Control`: `no-store`

**Note:** Legacy endpoint for image-only submissions. For PDF support, use `/submission-raw`.

---

### 4.10a GET /api/jobs/[id]/submission-raw

**File:** `apps/web/src/app/api/jobs/[id]/submission-raw/route.ts`

**Purpose:** Get the raw submission file (PDF or image) for a job.

**Request:**
- Method: `GET`
- Path: `/api/jobs/<jobId>/submission-raw`

**Response:**
- `200`: Raw file bytes (PNG/JPG/PDF)
- `404`: `{ error: string }` (job not found or file missing)
- `415`: `{ error: string }` (unsupported format)
- `500`: `{ error: string }` (HG_DATA_DIR missing)

**Headers:**
- `Content-Type`: `image/png`, `image/jpeg`, or `application/pdf` (based on `job.inputs.submissionMimeType` or inferred from extension)
- `Cache-Control`: `no-store`

**Note:** Used by Review Viewer page for PDF submissions. Supports all submission formats.

---

### 4.11 GET /api/reviews/[jobId]

**File:** `apps/web/src/app/api/reviews/[jobId]/route.ts`

**Purpose:** Get a review record (returns empty record if none exists).

**Request:**
- Method: `GET`
- Path: `/api/reviews/<jobId>`

**Response:**
- `200`: `{ ok: true, data: ReviewRecord }` (empty annotations array if not found)
- `500`: `{ ok: false, error: string }` (HG_DATA_DIR missing)

**Note:** Always returns a ReviewRecord, even if file doesn't exist (empty annotations).

---

### 4.12 PUT /api/reviews/[jobId]

**File:** `apps/web/src/app/api/reviews/[jobId]/route.ts`

**Purpose:** Create or update a review record.

**Request:**
- Method: `PUT`
- Path: `/api/reviews/<jobId>`
- Content-Type: `application/json`
- Body: `ReviewRecord` JSON

**Response:**
- `200`: `{ ok: true }`
- `400`: `{ ok: false, error: string }` (validation failed or jobId mismatch)
- `500`: `{ ok: false, error: string }` (HG_DATA_DIR missing or save error)

**Validation:** Validates body with `ReviewRecordSchema`, ensures `body.jobId` matches route param.

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
- "Open Review" link/button:
  - Shown when `jobId` exists (after job creation)
  - Non-intrusive link for PENDING/RUNNING/FAILED
  - Primary CTA button for DONE status
  - Links to `/reviews/<jobId>`
- "Start New Grading" button (resets form)

**Components Used:**
- `RubricCriterionRow` (`apps/web/src/components/RubricCriterionRow.tsx`) - Renders single criterion row

**Client Helpers:**
- `apps/web/src/lib/jobsClient.ts` - `getJob()` wrapper
- `apps/web/src/lib/reviewsClient.ts` - `getReview()` wrapper

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

### 5.4 /reviews/[jobId]

**File:** `apps/web/src/app/reviews/[jobId]/page.tsx`

**Purpose:** Review Viewer - displays submission image with AI annotation overlays.

**Features:**
- Loads job and review data on mount (parallel fetch)
- **Submission display:**
  - **PDF submissions**: Uses `PDFViewer` component (`/api/jobs/<jobId>/submission-raw`) with multi-page support
  - **Image submissions**: Direct image display (`/api/jobs/<jobId>/submission`)
- **Overlays bounding boxes:**
  - Absolute positioning using `bboxNorm` coordinates (x,y,w,h → CSS percentages)
  - For PDFs: Coordinates relative to each page's dimensions (rendered via react-pdf)
  - For images: Coordinates relative to image dimensions
  - Clickable rectangles (select annotation)
  - Visual highlighting for selected/hovered annotation
- **Side panel:**
  - Lists all annotations (label, criterionId/findingId, confidence, status)
  - Shows full comment when annotation selected
  - Maps `criterionId` to rubric criterion label (from `rubricEvaluation`)
  - Maps `findingId` to finding title (from `generalEvaluation`)
  - Filter by strengths/issues (for GENERAL mode)
  - Filter by question (for GENERAL per-question mode)
- **PDF-specific features:**
  - Page navigation with IntersectionObserver for active page detection
  - Annotations grouped by `pageIndex` (0-based)
  - Scroll-to-page when annotation selected
- **States:**
  - Loading state
  - Error banner if fetch fails
  - Warning if job status is not DONE (still allows viewing annotations)
- Navigation: "Back to Home", "All Reviews" links

**Components Used:**
- `PDFViewer` (`apps/web/src/components/review/pdf/PDFViewer.tsx`) - PDF rendering with page navigation

**Client Helpers:**
- `apps/web/src/lib/jobsClient.ts` - `getJob()`
- `apps/web/src/lib/reviewsClient.ts` - `getReview()`

**Note:** 
- **PDF submissions**: Displays annotations for all `pageIndex` values (multi-page support)
- **Image submissions**: Only displays annotations with `pageIndex === 0`

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

### 6.4 Gemini API Call (Grading)

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

### 6.5 Localization Pass (AI Annotations)

**File:** `apps/worker/src/core/localizeMistakes.ts` (RUBRIC mode)  
**File:** `apps/worker/src/core/localizeFindingsPerQuestion.ts` (GENERAL mode)

**Process (RUBRIC Mode):**
1. After grading succeeds, identifies target criteria (where `score < maxPoints`)
2. If no target criteria → returns empty annotations
3. Reads submission file and converts to base64
4. Builds prompt requesting bounding boxes for mistakes:
   - Lists target criteria with scores/feedback
   - Requests normalized coordinates (x, y, w, h in [0,1])
   - Specifies JSON output format
5. Calls Gemini with submission image only (no exam file)
6. Validates output with `LocalizationOutputSchema`:
   - Ensures `criterionId` matches target criteria
   - Validates `bboxNorm` coordinates (0..1, w/h > 0)
   - Validates `confidence` (0..1)
7. Converts to `Annotation` objects:
   - Generates stable ID: `ai-<criterionId>-<timestamp>-<random>`
   - Sets `createdBy: 'ai'`, `status: 'proposed'`, `pageIndex: 0`
8. Returns `{ ok: true, annotations }` or `{ ok: false, error }` (best-effort, doesn't throw)

**Process (GENERAL Mode):**
1. For each question evaluation in `generalEvaluation.questions`:
   - Identifies findings (issues and strengths)
   - **Mini-PDF handling**: If `miniPdfPath` exists (from `extractMiniPdf`), uses mini-PDF for localization; otherwise uses original submission
   - Reads submission file (or mini-PDF) and converts to base64
   - Builds prompt requesting bounding boxes for findings
   - Calls Gemini with submission image/PDF
   - Validates output with `GeneralFindingsLocalizationV1Schema`
   - Converts to `Annotation` objects with `findingId` and `questionId`
   - **PageIndex translation**: If mini-PDF was used, translates `pageIndex` from mini-PDF coordinates (0..miniPages-1) to original submission coordinates using `pageIndices` array
2. Combines all annotations (capped at 200 total)
3. Returns `{ ok: true, annotations }` or `{ ok: false, error }` (best-effort)

**Note:** Localization failure does NOT fail the job (job remains DONE).

**Mini-PDF Extraction:**
- **File:** `apps/worker/src/core/extractMiniPdf.ts`
- Extracts selected PDF pages into mini-PDFs using `pdf-lib`
- Output: `<HG_DATA_DIR>/uploads/derived/<jobId>/questions/<questionId>.pdf`
- Used for per-question evaluation in GENERAL mode to reduce context size

---

### 6.6 Normalize/Validate

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

### 6.7 Job Completion/Failure + Review Save

**File:** `apps/worker/src/lib/processNextPendingJob.ts`

**Process:**
1. Determines grading mode from `job.inputs.gradingMode` (default: 'RUBRIC')
2. **RUBRIC Mode:**
   - Calls `gradeSubmission(job)` → returns `RubricEvaluationResult`
   - Wraps result: `{ mode: 'RUBRIC', rubricEvaluation: gradeResult.result }`
   - Runs localization pass:
     - Calls `localizeMistakes()` with job data and rubricEvaluation
     - Loads or creates ReviewRecord via `getOrCreateReview(jobId)`
     - If localization succeeds: saves annotations to review
     - If localization fails: saves empty annotations (logs warning)
     - Always saves ReviewRecord (best-effort)
3. **GENERAL Mode:**
   - Calls `generalEvaluatePerQuestion(job)` → returns `GeneralEvaluation`
   - Wraps result: `{ mode: 'GENERAL', generalEvaluation: generalResult.result }`
   - Runs localization per question:
     - For each question in `generalEvaluation.questions`:
       - Checks for mini-PDF at `<HG_DATA_DIR>/uploads/derived/<jobId>/questions/<questionId>.pdf`
       - Calls `localizeFindingsPerQuestion()` with question data and mini-PDF path (if exists)
       - Collects annotations (with pageIndex translation if mini-PDF used)
     - Caps total annotations at 200
     - Saves ReviewRecord with all annotations
4. Completes job: `completeJob(jobId, resultJson)`:
   - **File:** `packages/local-job-store/src/fileJobStore.ts` (lines 197-210)
   - Reads job from `running/<jobId>.json`
   - Updates: `status = 'DONE'`, `updatedAt`, `resultJson`
   - Writes to `done/<jobId>.json`
   - Deletes `running/<jobId>.json`
5. On error: `failJob(jobId, errorMessage)`:
   - **File:** `packages/local-job-store/src/fileJobStore.ts` (lines 215-228)
   - Reads job from `running/<jobId>.json`
   - Updates: `status = 'FAILED'`, `updatedAt`, `errorMessage`
   - Writes to `failed/<jobId>.json`
   - Deletes `running/<jobId>.json`

**Review Storage Functions:**
- `getOrCreateReview(jobId)` - Returns ReviewRecord (empty if not found)
- `saveReview(review)` - Atomically saves ReviewRecord (temp file + rename)
- **File:** `packages/local-job-store/src/fileReviewStore.ts`

---

## 7. Review/Annotations System (v1) - IMPLEMENTED

### 7.1 Overview

**Status:** ✅ Fully implemented

The system includes:
- **AI-generated annotations**: Worker automatically generates bounding boxes for mistakes after grading
- **Review storage**: ReviewRecord v1 schema with annotations stored per job
- **Review Viewer**: Dedicated page (`/reviews/<jobId>`) showing submission image with annotation overlays
- **Open Review CTA**: Link/button on home page to access reviews

### 7.2 Implementation Details

**Schemas:** `packages/shared-schemas/src/review/v1/schemas.ts`
- `BBoxNorm` - Normalized bounding box coordinates (0..1)
- `Annotation` - Single annotation with bboxNorm, criterionId, label, comment, confidence
- `ReviewRecord` - Container for annotations per job

**Storage:** `packages/local-job-store/src/fileReviewStore.ts`
- `getReviewDir()` - Returns reviews directory path
- `loadReview(jobId)` - Loads ReviewRecord or returns null
- `saveReview(review)` - Atomically saves ReviewRecord (temp + rename)
- `getOrCreateReview(jobId)` - Returns ReviewRecord (empty if not found)

**Worker Integration:**
- **RUBRIC Mode**: `apps/worker/src/core/localizeMistakes.ts`
  - Runs after successful grading
  - Identifies criteria with `score < maxPoints`
  - Calls Gemini with submission image to generate bounding boxes
- **GENERAL Mode**: `apps/worker/src/core/localizeFindingsPerQuestion.ts`
  - Runs per question after `generalEvaluatePerQuestion()`
  - Uses mini-PDF if available (from `extractMiniPdf`)
  - Translates `pageIndex` from mini-PDF coordinates to original submission coordinates
- Best-effort: failures don't affect job status

**API Endpoints:**
- `GET /api/reviews` - List all reviews (summary)
- `GET /api/reviews/[jobId]` - Get review (returns empty if not found)
- `PUT /api/reviews/[jobId]` - Save review
- `GET /api/jobs/[id]/submission` - Get submission image file (PNG/JPG only)
- `GET /api/jobs/[id]/submission-raw` - Get raw submission file (PDF/image)

**UI:**
- `/reviews` - Reviews list page
- `/reviews/[jobId]` - Review Viewer page with PDF/image overlay (supports multi-page PDFs)
- Home page - "Open Review" CTA (prominent when DONE)

---

## Appendix: Key File Paths Reference

| Component | File Path |
|-----------|-----------|
| Job types | `packages/local-job-store/src/types.ts` |
| Job storage | `packages/local-job-store/src/fileJobStore.ts` |
| Rubric schemas | `packages/shared-schemas/src/rubric/v1/schemas.ts` |
| Rubric normalization | `packages/shared-schemas/src/rubric/v1/normalize.ts` |
| Review schemas | `packages/shared-schemas/src/review/v1/schemas.ts` |
| Review storage | `packages/local-job-store/src/fileReviewStore.ts` |
| Exam Index storage | `packages/local-job-store/src/fileExamIndexStore.ts` |
| Grading logic (RUBRIC) | `apps/worker/src/core/gradeSubmission.ts` |
| Grading logic (GENERAL) | `apps/worker/src/core/generalEvaluatePerQuestion.ts` |
| Localization logic (RUBRIC) | `apps/worker/src/core/localizeMistakes.ts` |
| Localization logic (GENERAL) | `apps/worker/src/core/localizeFindingsPerQuestion.ts` |
| PDF extraction | `apps/worker/src/core/extractMiniPdf.ts` |
| Worker loop | `apps/worker/src/scripts/runLoop.ts` |
| Job processing | `apps/worker/src/lib/processNextPendingJob.ts` |
| Gemini service | `apps/worker/src/services/geminiService.ts` |
| Home page | `apps/web/src/app/page.tsx` |
| Review Viewer | `apps/web/src/app/reviews/[jobId]/page.tsx` |
| Reviews List | `apps/web/src/app/reviews/page.tsx` |
| PDF Viewer component | `apps/web/src/components/review/pdf/PDFViewer.tsx` |
| Jobs API | `apps/web/src/app/api/jobs/route.ts` |
| Jobs submission API | `apps/web/src/app/api/jobs/[id]/submission/route.ts` |
| Jobs submission raw API | `apps/web/src/app/api/jobs/[id]/submission-raw/route.ts` |
| Reviews API | `apps/web/src/app/api/reviews/[jobId]/route.ts` |
| Reviews list API | `apps/web/src/app/api/reviews/route.ts` |
| Exams API | `apps/web/src/app/api/exams/route.ts` |
| Exam Index API | `apps/web/src/app/api/exams/[examId]/index/route.ts` |
| Rubrics API | `apps/web/src/app/api/rubrics/route.ts` |
| Health API | `apps/web/src/app/api/health/route.ts` |

---

## 9. Assumptions / Invariants

### 9.1 Bounding Box Coordinate Space

- **`bboxNorm` coordinates**: Always normalized to [0, 1] range
  - `x`, `y`: Top-left corner (0 = left/top edge, 1 = right/bottom edge)
  - `w`, `h`: Width and height (must be > 0, sum with x/y must be ≤ 1)
- **For images**: Coordinates are relative to image dimensions (width × height)
- **For PDFs**: Coordinates are relative to each page's rendered dimensions (varies by page)
- **Translation**: When mini-PDFs are used, `pageIndex` is translated from mini-PDF page order to original submission page indices

### 9.2 PageIndex Semantics

- **Images (PNG/JPG)**: Always `pageIndex === 0` (single page)
- **PDFs**: `pageIndex` is 0-based (0 = first page, 1 = second page, etc.)
- **Mini-PDFs**: When used, annotations initially have `pageIndex` relative to mini-PDF (0..miniPages-1), then translated to original submission coordinates

### 9.3 Fallback Behavior

- **ExamIndex missing**: Falls back to listing questionIds from rubrics directory; final fallback: single "DOCUMENT" questionId
- **Mini-PDF missing**: Falls back to using original submission file for localization
- **Localization failure**: Job remains DONE with empty annotations (best-effort)
- **ReviewRecord missing**: API returns empty ReviewRecord (empty annotations array)

### 9.4 File Storage Invariants

- **Exam files**: Stored in `exams/<examId>/assets/` but copied to `uploads/` when creating jobs
- **Submission files**: Always stored in `uploads/` with unique names
- **Mini-PDFs**: Created in `uploads/derived/<jobId>/questions/<questionId>.pdf` during GENERAL mode processing
- **Job files**: Stored in `jobs/{pending,running,done,failed}/` directories

---

**End of Report**

