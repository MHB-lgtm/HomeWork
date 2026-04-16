# Architecture Document Audit - Mismatch Table

## Top 10 Concrete Mismatches

| # | Doc Claim | Current Reality | Evidence | Impact |
|---|-----------|----------------|----------|--------|
| 1 | "Only displays annotations with `pageIndex === 0` (PNG/JPG support)" | Review Viewer supports PDFs with multi-page annotations. For PDFs, all `pageIndex` values are displayed. For images, only `pageIndex === 0` is shown. | `apps/web/src/app/reviews/[jobId]/page.tsx:131-135` - Filters annotations by `submissionMimeType === 'application/pdf'` vs `pageIndex === 0` | Misleading - PDF support is fully implemented but not documented |
| 2 | "GET /api/jobs/[id]/submission - Get submission image file" | Two endpoints exist: `/submission` (PNG/JPG only) and `/submission-raw` (PDF/image). Review Viewer uses `/submission-raw` for PDFs. | `apps/web/src/app/api/jobs/[id]/submission/route.ts:54` - Only supports `.png`, `.jpg`, `.jpeg`; `apps/web/src/app/api/jobs/[id]/submission-raw/route.ts` - Supports PDF/image; `apps/web/src/app/reviews/[jobId]/page.tsx:393` - Uses `/submission-raw` | Missing endpoint documentation causes confusion about PDF support |
| 3 | "Exam files copied per job" location unclear | Exam files are copied to `uploads/` with format `<examBaseName>_<jobId>.<ext>` (not stored in `exams/<examId>/assets/` for jobs). | `packages/local-job-store/src/fileJobStore.ts:71-76` - Copies exam file to `UPLOADS_DIR()` with unique name | Unclear where exam files are stored during job processing |
| 4 | Missing `uploads/derived/` directory | Mini-PDFs are extracted to `uploads/derived/<jobId>/questions/<questionId>.pdf` during GENERAL mode processing. | `apps/worker/src/core/extractMiniPdf.ts:66` - Creates `uploads/derived/<jobId>/questions/<questionId>.pdf` | Data layout incomplete - derived assets not documented |
| 5 | Missing `submissionMimeType` field | `JobRecord.inputs` includes `submissionMimeType?: string` to explicitly store MIME type (image/png, application/pdf, etc.). | `packages/local-job-store/src/types.ts:15` - `submissionMimeType?: string` field exists | JobRecord schema incomplete |
| 6 | Missing `examId` in JobRecord.inputs | `JobRecord.inputs` includes `examId?: string` (required going forward, optional for backward compatibility). Used for resolving exam resources. | `packages/local-job-store/src/types.ts:11` - `examId?: string` field exists; `apps/worker/src/core/generalEvaluatePerQuestion.ts:65` - Uses `resolveExamId(job)` | JobRecord schema incomplete - examId resolution not documented |
| 7 | "Localization logic: `localizeMistakes.ts`" | Two localization functions exist: `localizeMistakes()` for RUBRIC mode and `localizeFindingsPerQuestion()` for GENERAL mode. | `apps/worker/src/core/localizeMistakes.ts` - RUBRIC mode; `apps/worker/src/core/localizeFindingsPerQuestion.ts` - GENERAL mode; `apps/worker/src/lib/processNextPendingJob.ts:68-86` - Calls `localizeFindingsPerQuestion()` | Missing documentation for GENERAL mode localization |
| 8 | Missing mini-PDF extraction | `extractMiniPdf()` function extracts selected PDF pages into mini-PDFs for per-question evaluation in GENERAL mode. | `apps/worker/src/core/extractMiniPdf.ts:23-82` - Extracts pages using pdf-lib; `apps/worker/src/core/generalEvaluatePerQuestion.ts:227-248` - Uses mini-PDFs | Missing documentation for PDF page extraction feature |
| 9 | Missing pageIndex translation logic | When mini-PDFs are used, `pageIndex` from localization is translated from mini-PDF coordinates (0..miniPages-1) to original submission coordinates. | `apps/worker/src/core/localizeFindingsPerQuestion.ts:253-268` - Translates `pageIndex` if `isUsingMiniPdf && pageIndices` exists | Missing documentation for coordinate translation |
| 10 | Missing `generalQuestionMap` in resultJson | GENERAL mode resultJson may include `generalQuestionMap` and `generalQuestionMapError` fields for question-to-page mapping. | `apps/web/src/app/reviews/[jobId]/page.tsx:83-86` - Accesses `resultJson.generalQuestionMap` and `resultJson.generalQuestionMapError` | Result shape incomplete for GENERAL mode |

---

## Additional Findings

- **Review Viewer PDF support**: Uses `PDFViewer` component with `react-pdf` library, supports page navigation and IntersectionObserver for active page detection (`apps/web/src/components/review/pdf/PDFViewer.tsx:34-474`)
- **Annotation schema**: `Annotation` includes `findingId?` and `questionId?` fields for GENERAL mode (`packages/shared-schemas/src/review/v1/schemas.ts`)
- **Job processing**: `processNextPendingJob()` handles both RUBRIC and GENERAL modes with different localization paths (`apps/worker/src/lib/processNextPendingJob.ts:32-129`)
- **Exam file storage**: Exam files are stored in `exams/<examId>/assets/` but copied to `uploads/` when creating jobs (`packages/local-job-store/src/fileJobStore.ts:71-76`)
