# Domain & Workflow Foundation - Milestone 1

## Goal

Create a storage-agnostic domain foundation for the product so the repo has clear workflow boundaries before any final database decision is made.

By the end of this milestone, the repo must have:

- canonical domain entities for the course-centric product model,
- explicit lifecycle/state models,
- a formal publish boundary,
- repository contracts that are independent of Firestore, Postgres, or the filesystem,
- service-layer workflow boundaries,
- gradebook, audit, and flag contracts,
- pure business rules with executable tests.

This milestone defines the domain foundation. It does not migrate the current runtime onto that foundation.

## Non-goals

This milestone does not include:

- selecting the final DB,
- implementing Firestore collections or SQL tables,
- adding users, memberships, or final authz enforcement,
- changing existing route behavior,
- changing worker behavior,
- replacing file-backed persistence,
- adding notifications, analytics computation, or export pipelines,
- adding student or lecturer UI flows,
- broad runtime refactors in `apps/web` or `apps/worker`.

## Current-state summary

Current repo reality:

- `apps/web` is the main Next.js App Router app.
- `apps/worker` is the background worker.
- persistence is file-backed under `HG_DATA_DIR`.
- `packages/local-job-store` and `packages/local-course-store` are concrete filesystem-backed packages.
- `packages/shared-schemas` contains current wire/runtime payload schemas.
- current grading is job-oriented and exam-first.
- reviews exist as `ReviewRecord` plus annotations, but there is no publish boundary.
- there are no first-class canonical entities yet for `Week`, `Assignment`, `Submission`, `ReviewVersion`, `PublishedResult`, `GradebookEntry`, `ExamBatch`, `Flag`, or `AuditEvent`.

Current coupling problem:

- runtime handlers and worker code depend directly on concrete local-store packages,
- workflow rules are implicit and scattered,
- the current repo lacks a storage-independent domain layer.

## Scope of this milestone

This milestone will:

- add a new domain package under `packages/domain-workflow`,
- name it `@hg/domain-workflow`, following the already-established package naming convention in the repo:
  - `@hg/shared-schemas`
  - `@hg/local-job-store`
  - `@hg/local-course-store`
- define canonical entities, state models, repository interfaces, service boundaries, and pure rules there,
- define publish, gradebook, audit, and flag contracts,
- add executable tests for domain rules,
- add minimal filesystem adapters in the existing local-store packages.

This milestone will not:

- wire the new domain layer into existing API routes,
- wire the new domain layer into `apps/worker`,
- change current API response shapes,
- change current file layouts under `HG_DATA_DIR`,
- change `packages/shared-schemas` unless a tiny compatibility export becomes strictly necessary.

### Boundary with `shared-schemas`

This boundary is explicit:

- `packages/shared-schemas` remains the home for wire contracts, current runtime payloads, and API/storage-adjacent schemas.
- `@hg/domain-workflow` becomes the home for canonical domain entities, lifecycle models, repository interfaces, services, projections, and pure business rules.
- Translation between the two layers happens only in adapters or translators.
- This milestone must not create a second copy of current grading payload schemas inside the domain package.

### Runtime adoption policy

This milestone uses **zero runtime adoption**.

- No API handler is changed to call the new domain services.
- No worker file is changed to call the new domain services.
- The only integration work outside the new package is adapter code inside the two local-store packages.

## Canonical domain entities to introduce or formalize

Introduce the following canonical entities in `@hg/domain-workflow`.

### Shared value objects

Use discriminated references instead of sibling nullable IDs.

- `ModuleRef`
  - `{ kind: 'assignment'; assignmentId: string }`
  - `{ kind: 'exam_batch'; examBatchId: string }`

- `AssetRef`
  - storage-neutral file reference

- `StudentRef`
  - opaque stable identity reference for pre-user-table milestones

- `ActorRef`
  - opaque stable identity reference for pre-user-table milestones

Rules:

- `StudentRef` and `ActorRef` must not encode authorization logic,
- they exist only as placeholders for future identity convergence,
- domain entities must prefer discriminated refs over nullable parallel identifiers.

### Course

Fields:

- `courseId`
- `title`
- `status`
- `createdAt`
- `updatedAt`

### Week

Fields:

- `weekId`
- `courseId`
- `order`
- `title`
- `createdAt`
- `updatedAt`

### CourseMaterial

Fields:

- `materialId`
- `courseId`
- `kind`
- `assetRef`
- `title?`
- `createdAt`
- `updatedAt`

Minimum `kind` values:

- `assignment_prompt`
- `assignment_solution`
- `exam_original`
- `exam_model_solution`
- `submission_pdf`
- `derived_artifact`
- `export_bundle`
- `lecture_asset`

### Assignment

Fields:

- `assignmentId`
- `courseId`
- `weekId`
- `title`
- `openAt`
- `deadlineAt`
- `materialIds`
- `state`
- `createdAt`
- `updatedAt`

### Submission

Fields:

- `submissionId`
- `courseId`
- `moduleRef`
- `studentRef`
- `materialId`
- `submittedAt`
- `supersedesSubmissionId?`
- `state`

Business invariant:

- `moduleRef` is required and is the only origin reference.
- A submission is always for exactly one module origin:
  - assignment
  - exam batch

### Review

Fields:

- `reviewId`
- `courseId`
- `submissionId`
- `state`
- `currentVersionId?`
- `createdAt`
- `updatedAt`

### ReviewVersion

Fields:

- `reviewVersionId`
- `reviewId`
- `kind`
- `resultEnvelope`
- `createdAt`
- `actorRef?`

`kind` values:

- `ai_draft`
- `lecturer_edit`
- `published_snapshot`

### ReviewResultEnvelope

This is the minimum normalized contract the domain layer needs from grading output.

Fields:

- `rawPayload: unknown`
- `score?: number`
- `maxScore?: number`
- `summary?: string`
- `questionBreakdown?: unknown`
- `flags?: { code: string; summary: string; severity?: 'low' | 'medium' | 'high' }[]`

Rules:

- the domain package does not redesign current grading payloads,
- `rawPayload` preserves the original grading result,
- publish logic depends only on the normalized subset above,
- `PublishedResult` creation requires:
  - `score`
  - `maxScore`
  - `summary`

### PublishedResult

Fields:

- `publishedResultId`
- `courseId`
- `submissionId`
- `moduleRef`
- `reviewId`
- `sourceReviewVersionId`
- `publishedAt`
- `status`
- `finalScore`
- `maxScore`
- `summary`
- `breakdownSnapshot`

`status` values:

- `effective`
- `superseded`

Historical rule:

- multiple `PublishedResult` records may exist historically for the same submission,
- exactly one may be `effective` at a time,
- all older published results for that submission become `superseded`,
- gradebook projection always uses the latest `effective` published result.

### GradebookEntry

Fields:

- `gradebookEntryId`
- `courseId`
- `studentRef`
- `moduleRef`
- `publishedResultId`
- `score`
- `maxScore`
- `status`
- `publishedAt`

Business invariant:

- `moduleRef` must exactly match the `moduleRef` of the source `PublishedResult`.

### ExamBatch

Fields:

- `examBatchId`
- `courseId`
- `title`
- `materialIds`
- `state`
- `createdAt`
- `updatedAt`
- `exportedAt?`

### Flag

Fields:

- `flagId`
- `scopeType`
- `scopeId`
- `source`
- `severity`
- `status`
- `code`
- `summary`
- `createdAt`
- `updatedAt`

`source` values:

- `ai`
- `lecturer`
- `rule`

### AuditEvent

Fields:

- `eventId`
- `aggregateType`
- `aggregateId`
- `eventType`
- `occurredAt`
- `actorRef?`
- `payload`

## Lifecycle/state models to define

### AssignmentState

- `draft`
- `open`
- `closed`
- `processing`
- `reviewed`
- `published`

Allowed transitions:

- `draft -> open`
- `open -> closed`
- `closed -> processing`
- `processing -> reviewed`
- `reviewed -> published`

Invalid by default:

- `draft -> processing`
- `open -> processing` before deadline

### SubmissionState

- `uploaded`
- `superseded`
- `queued`
- `processed`
- `lecturer_edited`
- `published`

Allowed transitions:

- `uploaded -> superseded`
- `uploaded -> queued`
- `queued -> processed`
- `processed -> lecturer_edited`
- `processed -> published`
- `lecturer_edited -> published`

Rule:

- only one latest effective submission may remain active for a student and module origin,
- older active submissions are moved to `superseded`.

### ReviewState

- `draft`
- `ready_for_review`
- `lecturer_edited`
- `published`

Allowed transitions:

- `draft -> ready_for_review`
- `ready_for_review -> lecturer_edited`
- `ready_for_review -> published`
- `lecturer_edited -> published`

### ExamBatchState

- `uploaded`
- `processing`
- `reviewed`
- `exported`

Allowed transitions:

- `uploaded -> processing`
- `processing -> reviewed`
- `reviewed -> exported`

Invalid by default:

- `uploaded -> exported`
- `processing -> exported`

### FlagState

- `open`
- `resolved`
- `dismissed`

Allowed transitions:

- `open -> resolved`
- `open -> dismissed`

No transitions out of `resolved` or `dismissed` in this milestone.

## Publish boundary design

The publish boundary is the main workflow boundary of this milestone.

Design:

- `Review` is the working aggregate.
- `ReviewVersion` is append-only and immutable.
- `PublishedResult` is the only student-safe published truth.
- `GradebookEntry` is projected only from the latest `effective` `PublishedResult`.

Publication flow contract:

1. Load the review and the source review version.
2. Validate publishability from `resultEnvelope`.
3. Create a new `published_snapshot` `ReviewVersion`.
4. Create a new `PublishedResult` with `status=effective`.
5. Mark any previous effective published result for the same submission as `superseded`.
6. Project or refresh the `GradebookEntry` from the new effective published result.
7. Emit audit events.

Defaults:

- publication may originate from `ai_draft` or `lecturer_edit`,
- publication never mutates the source review version,
- re-publish always creates a new review version and a new published result,
- student-facing surfaces must depend on `PublishedResult`, never on working `Review`.

## Repository interface plan

Define storage-neutral repository interfaces in `@hg/domain-workflow`.

### Core repositories

- `CourseRepository`
  - get/save `Course`
  - list/get/save `Week`

- `MaterialRepository`
  - get/save/list `CourseMaterial`

- `AssignmentRepository`
  - get/save/list `Assignment`

- `SubmissionRepository`
  - get/save/list `Submission`
  - find latest effective submission for a given `studentRef + moduleRef`
  - mark older submissions as superseded

- `ReviewRepository`
  - get/save `Review`
  - append/list `ReviewVersion`
  - set current review version

- `PublicationRepository`
  - get/save/list `PublishedResult`
  - get effective published result by submission
  - mark prior effective result as superseded
  - upsert/list `GradebookEntry`

- `ExamBatchRepository`
  - get/save/list `ExamBatch`

- `FlagRepository`
  - get/save/list `Flag`

- `AuditRepository`
  - append/list `AuditEvent`

- `AssetStoragePort`
  - register/resolve `AssetRef`

### Repository rules

- interfaces must not mention Firestore, SQL, or filesystem path semantics,
- repositories expose domain concepts only,
- storage-specific translation stays outside services.

### Adapter scope for this milestone

Only add concrete filesystem adapters for concepts that already have meaningful backing today:

- `CourseRepository` and minimal `MaterialRepository` adapter in `local-course-store`
- `ReviewRepository` adapter in `local-job-store`
- `AssetStoragePort` adapter over current local file locations

Do not add concrete filesystem persistence in this milestone for:

- `Assignment`
- `Submission`
- `PublishedResult`
- `GradebookEntry`
- `ExamBatch`
- `Flag`
- `AuditEvent`

For those, this milestone provides contracts, services, and tests only. Concrete persistence is deferred.

## Service layer plan

Create pure orchestration services in `@hg/domain-workflow`.

### AssignmentWorkflowService

Responsibilities:

- validate assignment transitions,
- determine whether grading may be queued,
- resolve effective submission rules.

### ReviewWorkflowService

Responsibilities:

- create working review aggregates,
- append AI draft and lecturer edit versions,
- maintain current-version semantics.

### PublicationService

Responsibilities:

- validate publishability from `ReviewResultEnvelope`,
- create `published_snapshot` review versions,
- create effective `PublishedResult`,
- supersede any prior effective published result for the same submission,
- project `GradebookEntry`,
- emit audit events.

### ExamBatchWorkflowService

Responsibilities:

- validate exam batch transitions,
- enforce reviewed-before-export rules.

### FlagService

Responsibilities:

- normalize flag creation,
- enforce flag transitions,
- keep source semantics explicit.

### Service rules

- services depend only on repository interfaces and pure rules,
- services do not know about filesystem paths,
- services do not enforce auth/authz,
- services do not call web or worker code directly.

## Gradebook/read-model contract plan

Introduce gradebook projection logic as a dedicated source file.

Required file:

- `packages/domain-workflow/src/projections/gradebook.ts`

Design:

- `GradebookEntry` is a read model,
- the source of truth remains `PublishedResult`,
- gradebook entries are created only from the latest `effective` published result,
- gradebook is not an analytics snapshot.

Projection rules:

- project only from `PublishedResult`,
- never project from AI drafts or un-published lecturer state,
- copy `moduleRef` from the source `PublishedResult`,
- reject projection if `PublishedResult.status !== 'effective'`.

## Audit and flag contract plan

### Audit

Introduce immutable `AuditEvent` contracts for:

- assignment state changes,
- submission registration,
- submission supersession,
- review version creation,
- publish actions,
- effective published-result replacement,
- exam batch export actions,
- flag resolution actions.

Rules:

- audit events are append-only,
- actor refs remain opaque in this milestone,
- audit contracts are defined now even though concrete persistence is deferred.

### Flags

Introduce first-class `Flag` contracts with:

- `source: ai | lecturer | rule`
- `severity: low | medium | high`
- `status: open | resolved | dismissed`
- `scopeType`
- `scopeId`
- `code`
- `summary`

Rules:

- flags are non-blocking by default,
- only the transitions defined in section 6 are allowed,
- no publish-blocking policy is introduced in this milestone.

## File/storage abstraction plan

Define a storage abstraction that hides raw filesystem paths from the domain layer.

### AssetRef

Fields:

- `assetId`
- `storageKind`
- `logicalBucket`
- `path`
- `mimeType?`
- `sizeBytes?`
- `originalName?`

Rules:

- domain entities depend on `AssetRef`, not raw paths,
- filesystem paths stay inside adapters,
- the abstraction must support current local files and future object storage.

### Adapter policy

Filesystem mapping stays in adapter code only for:

- local exam files,
- local submission files,
- local review assets,
- local course assets.

## Test plan for domain rules

Use Vitest only for the new package.

Test categories:

- assignment transition validity,
- submission supersession and effective-submission selection,
- review version append semantics,
- publish eligibility from `ReviewResultEnvelope`,
- `PublishedResult` creation,
- latest-effective published-result replacement,
- gradebook projection logic,
- exam batch export guards,
- flag transition rules,
- audit event emission contracts.

Adapter tests should be minimal and translation-focused only:

- mapping current `ReviewRecord` data into domain review contracts,
- mapping current course/lecture asset metadata into `CourseMaterial` and `AssetRef`.

No route tests, UI tests, or worker behavior tests are added in this milestone.

## Exact file plan

### New package

Create a new package at:

- `packages/domain-workflow/package.json`
- `packages/domain-workflow/tsconfig.json`
- `packages/domain-workflow/src/index.ts`

Core files:

- `packages/domain-workflow/src/refs.ts`
- `packages/domain-workflow/src/states.ts`
- `packages/domain-workflow/src/repositories.ts`
- `packages/domain-workflow/src/storage.ts`
- `packages/domain-workflow/src/result-envelope.ts`

Entity files:

- `packages/domain-workflow/src/entities/course.ts`
- `packages/domain-workflow/src/entities/assignment.ts`
- `packages/domain-workflow/src/entities/submission.ts`
- `packages/domain-workflow/src/entities/review.ts`
- `packages/domain-workflow/src/entities/publication.ts`
- `packages/domain-workflow/src/entities/exam-batch.ts`
- `packages/domain-workflow/src/entities/flag.ts`
- `packages/domain-workflow/src/entities/audit.ts`

Rule and service files:

- `packages/domain-workflow/src/rules/assignment.ts`
- `packages/domain-workflow/src/rules/submission.ts`
- `packages/domain-workflow/src/rules/review.ts`
- `packages/domain-workflow/src/rules/publication.ts`
- `packages/domain-workflow/src/rules/exam-batch.ts`
- `packages/domain-workflow/src/rules/flag.ts`
- `packages/domain-workflow/src/services/assignment-workflow.ts`
- `packages/domain-workflow/src/services/review-workflow.ts`
- `packages/domain-workflow/src/services/publication.ts`
- `packages/domain-workflow/src/services/exam-batch-workflow.ts`
- `packages/domain-workflow/src/services/flag.ts`
- `packages/domain-workflow/src/projections/gradebook.ts`

Tests:

- `packages/domain-workflow/test/assignment.test.ts`
- `packages/domain-workflow/test/submission.test.ts`
- `packages/domain-workflow/test/review.test.ts`
- `packages/domain-workflow/test/publication.test.ts`
- `packages/domain-workflow/test/gradebook.test.ts`
- `packages/domain-workflow/test/exam-batch.test.ts`
- `packages/domain-workflow/test/flag.test.ts`

### Existing package changes

Only these existing packages are touched:

- `packages/local-job-store/package.json`
- `packages/local-job-store/src/domainAdapters.ts`
- `packages/local-course-store/package.json`
- `packages/local-course-store/src/domainAdapters.ts`

Purpose:

- implement minimal filesystem-backed adapters for currently-backed concepts,
- keep all existing `file*.ts` behavior intact,
- keep direct path handling out of the new domain package.

### Files that remain unchanged in this milestone

- `apps/web/**`
- `apps/worker/**`
- `packages/shared-schemas/**` by default
- current `fileJobStore`, `fileReviewStore`, `fileExamIndexStore`, `fileCourseStore`, `fileLectureStore`, and `fileCourseRagIndex` behavior

Expected workspace-wide changes beyond source:

- `pnpm-lock.yaml`

## Validation commands

Package/filter naming is grounded in actual repo package names:

- existing verified package names:
  - `@hg/shared-schemas`
  - `@hg/local-job-store`
  - `@hg/local-course-store`
- new package name to create in this milestone:
  - `@hg/domain-workflow`

The new package must define `build` and `test` scripts in its own `package.json`.

Run after implementation:

- `pnpm --filter @hg/domain-workflow build`
- `pnpm --filter @hg/domain-workflow test`
- `pnpm --filter @hg/local-job-store build`
- `pnpm --filter @hg/local-course-store build`
- `pnpm --filter web build`
- `pnpm --filter worker build`

## Manual acceptance checklist

- the new domain package builds cleanly,
- domain-rule tests pass,
- `shared-schemas` still clearly owns wire/runtime payloads,
- `domain-workflow` clearly owns canonical domain entities and rules,
- no API route files changed,
- no worker runtime files changed,
- local-store adapter files compile and wrap existing stores without changing current storage behavior,
- publish boundary contracts exist in code,
- `ReviewResultEnvelope` includes the minimum normalized fields needed for publication,
- gradebook projection logic exists in a dedicated source file,
- flag transition rules are explicit and tested,
- latest-effective published-result semantics are explicit and tested.

## Risks and follow-ups

### Risks

- concept duplication between `shared-schemas` and `domain-workflow` if translators are not kept strict,
- adapter scope creeping beyond currently-backed concepts,
- over-designing future persistence concerns into the domain package.

### Follow-ups after this milestone

- auth foundation implementation,
- course membership and authorization model,
- persistence decision and repository implementations beyond filesystem adapters,
- runtime adoption of the domain layer in selected APIs,
- assignment workflow runtime implementation,
- exam batch workflow runtime implementation,
- notifications, analytics, and export milestones.

## Definition of done

This milestone is done when:

- `packages/domain-workflow` exists and follows the repo's established `@hg/*` naming convention,
- canonical domain entities are formalized there,
- lifecycle/state models are explicit,
- publish boundary contracts are explicit,
- `ReviewResultEnvelope` defines the minimum normalized fields required for publish logic,
- gradebook, audit, and flag contracts are explicit,
- repository interfaces are storage-agnostic,
- service-layer workflow boundaries are defined,
- gradebook projection logic exists in a dedicated source file,
- discriminated module refs replace nullable origin refs in the domain model,
- opaque `studentRef` and `actorRef` semantics are documented in code,
- filesystem adapters exist only for currently-backed concepts,
- pure-rule tests pass,
- `apps/web` and `apps/worker` runtime behavior remain unchanged.
