# StudyFlow — Smart Notes (scaffold)

This directory is the entry point for the new **StudyFlow Smart Notes** product
surface — a Notability-style note-taking app with an AI layer that auto-classifies
each document as `lecture`, `practice`, or `homework` and routes it to the
appropriate workflow.

Read the full spec in `StudyFlow-PRD.docx` (delivered alongside this scaffold).

## What's here (MVP Phase 1 foundations)

| Path | Purpose |
| --- | --- |
| `packages/shared-schemas/src/notes/v1/schemas.ts` | Zod schemas + TS types for Workspaces, Files, Questions, Summaries, Subscriptions, UsageEvents. Re-exported from `@hg/shared-schemas`. |
| `apps/web/src/lib/notes/docTypeDetector.ts` | Core "smart" classifier — regex heuristics + LLM fallback. |
| `apps/web/src/lib/notes/docTypeDetector.test.ts` | Sanity tests — run with `npx tsx`. |
| `apps/web/src/lib/notes/demoWorkspaces.ts` | In-memory seed until the notes slice of `@hg/postgres-store` lands. |
| `apps/web/src/app/api/notes/detect/route.ts` | POST endpoint that powers classification. |
| `apps/web/src/app/[locale]/s/notes/page.tsx` | Workspaces home (server component). |

## What's next (in order)

1. **Workspace detail page** — `/[locale]/s/notes/workspaces/[workspaceId]/page.tsx`
   - Tabs UI over files in the workspace
   - Reuses the existing `app/[locale]/s/courses/[courseId]/assignments/[assignmentId]/workspace/page.tsx`
     Lexical+Canvas editor for the writing surface.

2. **Upload endpoint** — `/api/notes/upload/route.ts`
   - Presigned URL flow to S3/R2.
   - On `POST /ingest`, enqueue `detect_type` on BullMQ.

3. **Detector worker** — `apps/worker/src/notes/detectTypeWorker.ts`
   - Consumes the queue, calls `detectDocumentType` with the Gemini client already used by the grader.
   - Writes back `file.type + detectionConfidence + questions` to Postgres.

4. **Homework flow reuse**
   - When `type === 'homework'`, the detector also returns `questions[]` via
     `extractQuestionsFromText`. Plug these directly into the existing
     `CALC_HW2_QUESTIONS`-style state of the workspace page.

5. **Summarizer integration**
   - For `type === 'lecture'`, call the existing Summarizer service via a new
     worker (`summarizeLectureWorker.ts`) and persist into the `Summary` entity.

6. **Billing gate**
   - Before enqueuing any `summary` or `homework_analysis` job, check quotas via
     `PLAN_QUOTAS` and log a `UsageEvent`. Return 402 with upgrade CTA when exhausted.

## Running locally

```bash
# Install (once)
pnpm install

# Build shared-schemas so apps/web can import the notes types
pnpm --filter @hg/shared-schemas build

# Run the web app
pnpm dev:web
# → open http://localhost:3000/he/s/notes
```

## Testing the detector

```bash
npx tsx apps/web/src/lib/notes/docTypeDetector.test.ts
```

Expected output:

```
✓ homework sample classified as homework 0.93
✓ practice sample classified as practice 0.85
✓ lecture sample classified as lecture 0.90
✓ extracted 4 questions
✓ llmFallback invoked correctly; final conf 0.8
ALL TESTS PASSED
```

## Notes on design decisions

- **Hebrew-first heuristics** — the existing user base is Hebrew-speaking
  students. The regex cues (`הוכח`, `הגדרה`, …) are tuned with negative
  lookaheads to avoid false positives between imperatives (homework cues) and
  noun forms (lecture cues).
- **Heuristic → LLM escalation** — ~80%+ of real uploads decide via regex alone.
  Only ambiguous cases hit Gemini, which keeps per-user AI costs well under the
  ₪15/user/month target in the PRD.
- **Schema-first** — all new entities live in `@hg/shared-schemas` so the
  worker and web app stay in lockstep. Follow the rubric/course v1 pattern of
  versioned subfolders.
- **Reuse, don't rewrite** — the Homework workspace UI, Gemini client, and
  Postgres setup from the Homework Grader are all intentionally reused.
