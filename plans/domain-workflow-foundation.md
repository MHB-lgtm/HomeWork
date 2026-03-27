# Domain & Workflow Foundation

Status: completed milestone record
Last updated: 2026-03-27

## 1. Goal

Establish a storage-agnostic domain foundation for the repo before choosing or adopting a production persistence layer.

This milestone was about defining canonical workflow boundaries, not migrating runtime behavior.

## 2. What was implemented

### New package

The milestone added:

- `packages/domain-workflow`
- package name: `@hg/domain-workflow`

The package now contains:

- canonical domain entities
- lifecycle state types
- repository interfaces
- pure workflow rules
- orchestration services
- gradebook projection logic
- package-local Vitest coverage

### Canonical contracts introduced

Implemented domain concepts include:

- `Course`
- `Week`
- `CourseMaterial`
- `Assignment`
- `Submission`
- `Review`
- `ReviewVersion`
- `PublishedResult`
- `GradebookEntry`
- `ExamBatch`
- `Flag`
- `AuditEvent`

Implemented supporting contracts include:

- `ModuleRef`
- `AssetRef`
- `StudentRef`
- `ActorRef`
- `ReviewResultEnvelope`

### Publish-boundary model introduced

The milestone formalized the publish boundary in code:

- `Review` is the working aggregate
- `ReviewVersion` is append-only history
- `PublishedResult` is the student-safe published truth
- `GradebookEntry` is a projection from the effective published result

### Services and rules introduced

Implemented service/rule areas include:

- assignment workflow rules
- submission supersession rules
- review transition rules
- publication rules
- exam-batch transition rules
- flag transition rules
- gradebook projection rules

### Filesystem adapter work introduced

The milestone added thin adapters in the existing local-store packages:

- `packages/local-job-store/src/domainAdapters.ts`
- `packages/local-course-store/src/domainAdapters.ts`

Those adapters expose currently backed data in domain shapes without changing runtime persistence behavior.

## 3. What was intentionally left unchanged

The milestone intentionally did **not** change:

- `apps/web` runtime behavior
- `apps/worker` runtime behavior
- current API response shapes
- current `HG_DATA_DIR` layout
- current file-backed queue/review/course/RAG behavior
- `packages/shared-schemas` ownership of wire/runtime payloads

In particular:

- route handlers still call file-backed stores directly
- worker code still calls file-backed stores directly
- the domain package is not the committed runtime persistence layer yet

## 4. Runtime and persistence boundaries after the milestone

After this milestone:

- `packages/shared-schemas` remains the home for current payload schemas
- `packages/domain-workflow` owns canonical domain language and workflow rules
- `packages/local-job-store` and `packages/local-course-store` remain the active runtime persistence packages
- translation between current file-backed data and canonical domain shapes happens in thin adapter code

This means the repo now has a clean domain boundary without runtime adoption yet.

## 5. What the milestone did not do

This milestone did **not**:

- choose the final database
- add PostgreSQL, Prisma, Firestore, or any ORM
- add users or memberships
- add auth or authz
- add runtime persistence for:
  - `PublishedResult`
  - `GradebookEntry`
  - `Flag`
  - `AuditEvent`
- migrate application routes onto domain services
- migrate worker flows onto domain services
- add notifications, analytics, or export pipelines

## 6. Validation record

The milestone closeout validations were:

- `pnpm --filter @hg/domain-workflow build`
- `pnpm --filter @hg/domain-workflow test`
- `pnpm --filter @hg/local-job-store build`
- `pnpm --filter @hg/local-course-store build`
- `pnpm --filter web build`
- `pnpm --filter worker build`

These commands verified that the new package and thin adapters compiled without changing runtime behavior.

## 7. Resulting architectural position

At the end of this milestone the repo had:

- a canonical domain package
- explicit publication contracts
- clear storage-agnostic repository boundaries
- thin local adapters
- zero committed runtime adoption by design

That was the intended stopping point.

## 8. Follow-on milestones

The next major architecture work moved to:

- persistence and identity design
- narrow PostgreSQL-backed review runtime slices on the current branch
- eventual PostgreSQL + Prisma adoption
- future auth/session and course-membership work

Those follow-on milestones are separate from this completed foundation milestone and should not be retroactively folded into it.
