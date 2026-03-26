# Postgres + Prisma Persistence & Identity Design

## Goal

Define exactly how the existing domain foundation maps to PostgreSQL, Prisma, identity, memberships, ownership, and course-scoped authorization before runtime implementation begins.

By the end of the next coding milestone, the repo should be able to add a relational persistence layer and a first DB-backed runtime seam without redesigning the domain model again.

## Non-goals

This milestone does not include:

- implementing runtime adoption in `apps/web` or `apps/worker`,
- writing Prisma schema or migrations yet,
- wiring Auth.js or any provider into the app,
- introducing student or lecturer UI changes,
- migrating the full file-backed runtime in one step,
- implementing analytics snapshots, notifications, or export storage beyond schema planning,
- changing the canonical domain contracts in `@hg/domain-workflow` unless a concrete mismatch is discovered later during implementation.

## Current implemented foundation summary

The repo already has:

- `@hg/domain-workflow` with canonical entities, states, repository interfaces, services, and projections,
- explicit publish-boundary concepts:
  - `Review`
  - `ReviewVersion`
  - `PublishedResult`
  - `GradebookEntry`
- zero runtime adoption by design,
- file-backed local stores still active in `@hg/local-job-store` and `@hg/local-course-store`,
- opaque `studentRef` and `actorRef` values in the domain layer,
- no database, no Prisma, no users, no memberships, and no authorization enforcement yet.

This means the logical model is defined, but the persistence, identity, and permission model are still missing.

## PostgreSQL + Prisma design principles for this repo

- Use PostgreSQL as the canonical operational store for identity, memberships, reviews, publication state, gradebook projections, flags, and audit events.
- Use Prisma as the default repository implementation layer, but allow raw SQL migrations where Prisma schema DSL is insufficient.
- Keep `@hg/domain-workflow` storage-agnostic; implement repository adapters in a separate Postgres package rather than pushing Prisma into the domain package.
- Store every course-owned record with a direct `courseId` column even when the relation is derivable. This is required for efficient course-scoped authorization filters and indexes.
- Use normalized relational columns for query-critical fields and `jsonb` for opaque or snapshot fields.
- Use transactions for multi-record invariants, especially publication and gradebook projection updates.
- Keep the file-backed worker queue unchanged in the first persistence implementation slice.
- Preserve current HTTP shapes during first runtime adoption; DB adoption should happen behind existing handlers first.

## Prisma schema v1 recommendation

### Recommended shared DB package

Create a shared package for Prisma-backed persistence, for example:

- `packages/postgres-store`
- package name: `@hg/postgres-store`

This package should own:

- `prisma/schema.prisma`
- Prisma migrations
- Prisma client wrapper
- repository implementations for `@hg/domain-workflow`
- import/migration scripts from file-backed data

This keeps DB logic shared between `apps/web` and future worker adoption.

### Core model set

Recommended Prisma v1 models:

- `User`
- `AuthAccount`
- `IdentityAlias`
- `Course`
- `CourseMembership`
- `StoredAsset`
- `CourseMaterial`
- `Week`
- `Assignment`
- `AssignmentMaterialLink`
- `ExamBatch`
- `ExamBatchMaterialLink`
- `Submission`
- `Review`
- `ReviewVersion`
- `PublishedResult`
- `GradebookEntry`
- `Flag`
- `AuditEvent`

### Column and type conventions

Use these defaults consistently:

- primary keys: `String @id @default(uuid()) @db.Uuid`
- timestamps: `DateTime @db.Timestamptz(6)`
- scores: `Decimal @db.Decimal(8,2)` rather than float
- large opaque payloads and snapshots: `Json` mapped to PostgreSQL `jsonb`
- enums for status/role/state columns where the domain already has fixed variants

### Relational mapping details

#### Identity

`User`
- core person/platform identity
- fields:
  - `id`
  - `normalizedEmail?`
  - `displayName?`
  - `globalRole`
  - `status`
  - `createdAt`
  - `updatedAt`

`AuthAccount`
- external auth provider identity mapping
- fields:
  - `id`
  - `userId`
  - `provider`
  - `providerAccountId`
  - `providerEmail?`
  - `metadata Json?`
  - `createdAt`
- unique:
  - `(provider, providerAccountId)`

`IdentityAlias`
- non-auth alias mapping for legacy refs and institutional identifiers
- fields:
  - `id`
  - `userId`
  - `kind`
  - `value`
  - `normalizedValue`
  - `createdAt`
- unique:
  - `(kind, normalizedValue)`

#### Course and membership

`Course`
- fields:
  - `id`
  - `title`
  - `status`
  - `createdAt`
  - `updatedAt`

`CourseMembership`
- one row per user per course
- fields:
  - `id`
  - `courseId`
  - `userId`
  - `role`
  - `status`
  - `joinedAt?`
  - `invitedByUserId?`
  - `createdAt`
  - `updatedAt`
- unique:
  - `(courseId, userId)`

#### Files and materials

`StoredAsset`
- persistent DB representation of `AssetRef`
- fields:
  - `id`
  - `storageKind`
  - `logicalBucket`
  - `path`
  - `mimeType?`
  - `sizeBytes?`
  - `originalName?`
  - `metadata Json?`
  - `createdAt`

`CourseMaterial`
- fields:
  - `id`
  - `courseId`
  - `assetId`
  - `kind`
  - `title?`
  - `createdAt`
  - `updatedAt`

#### Assignments and exam batches

`Week`
- fields:
  - `id`
  - `courseId`
  - `ordinal`
  - `title`
  - `createdAt`
  - `updatedAt`
- unique:
  - `(courseId, ordinal)`

`Assignment`
- fields:
  - `id`
  - `courseId`
  - `weekId`
  - `title`
  - `openAt`
  - `deadlineAt`
  - `state`
  - `createdAt`
  - `updatedAt`

`AssignmentMaterialLink`
- join table for `Assignment.materialIds`
- fields:
  - `assignmentId`
  - `courseMaterialId`
- unique:
  - `(assignmentId, courseMaterialId)`

`ExamBatch`
- fields:
  - `id`
  - `courseId`
  - `title`
  - `state`
  - `exportedAt?`
  - `createdAt`
  - `updatedAt`

`ExamBatchMaterialLink`
- join table for `ExamBatch.materialIds`
- fields:
  - `examBatchId`
  - `courseMaterialId`
- unique:
  - `(examBatchId, courseMaterialId)`

#### Submissions

`Submission`
- fields:
  - `id`
  - `courseId`
  - `studentUserId`
  - `moduleType`
  - `assignmentId?`
  - `examBatchId?`
  - `materialId`
  - `submittedAt`
  - `state`
  - `supersedesSubmissionId?`
  - `legacyJobId?`
  - `currentPublishedResultId?`
  - `createdAt`
  - `updatedAt`

Use a DB check constraint and repository validation so that:

- exactly one of `assignmentId` or `examBatchId` is non-null,
- `moduleType` matches the populated relation,
- `legacyJobId` is nullable and transitional, used only to bridge current review routes and file-backed history.

#### Reviews and review versions

`Review`
- fields:
  - `id`
  - `courseId`
  - `submissionId`
  - `state`
  - `currentVersionId?`
  - `createdAt`
  - `updatedAt`
- unique:
  - `submissionId`

`ReviewVersion`
- fields:
  - `id`
  - `reviewId`
  - `kind`
  - `actorUserId?`
  - `actorKind`
  - `actorRefRaw?`
  - `score?`
  - `maxScore?`
  - `summary?`
  - `questionBreakdown Json?`
  - `rawPayload Json`
  - `flagsJson Json?`
  - `createdAt`

This preserves both the normalized fields needed for domain logic and the raw payload needed for lineage.

#### Published results and gradebook

`PublishedResult`
- fields:
  - `id`
  - `courseId`
  - `submissionId`
  - `studentUserId`
  - `moduleType`
  - `assignmentId?`
  - `examBatchId?`
  - `reviewId`
  - `sourceReviewVersionId`
  - `publishedAt`
  - `status`
  - `finalScore`
  - `maxScore`
  - `summary`
  - `breakdownSnapshot Json`
  - `createdAt`

`GradebookEntry`
- current-only projection row
- fields:
  - `id`
  - `courseId`
  - `studentUserId`
  - `moduleType`
  - `assignmentId?`
  - `examBatchId?`
  - `publishedResultId`
  - `score`
  - `maxScore`
  - `status`
  - `publishedAt`
  - `createdAt`
  - `updatedAt`

Use a DB check constraint for `moduleType` parity here too.

#### Flags and audit

`Flag`
- fields:
  - `id`
  - `courseId`
  - `scopeType`
  - `scopeId`
  - `submissionId?`
  - `reviewId?`
  - `publishedResultId?`
  - `examBatchId?`
  - `source`
  - `severity`
  - `status`
  - `code`
  - `summary`
  - `createdAt`
  - `updatedAt`

`AuditEvent`
- fields:
  - `id`
  - `courseId?`
  - `aggregateType`
  - `aggregateId`
  - `eventType`
  - `actorUserId?`
  - `actorKind`
  - `actorRefRaw?`
  - `payload Json`
  - `occurredAt`

## Identity model v1

### Recommended v1 shape

Use a provider-agnostic identity model:

- `User` is the canonical person record used by domain data and permissions.
- `AuthAccount` connects a `User` to one or more auth provider identities later.
- `IdentityAlias` maps legacy and institutional identifiers to a `User`.

This keeps the persistence model stable even if auth provider details change later.

### Global roles

Use a small global role enum on `User`:

- `USER`
- `SUPER_ADMIN`

Do not put lecturer or student as global roles. Those are course-scoped and belong in `CourseMembership`.

### Legacy ref migration

Map current opaque refs like this:

- `studentRef` -> `IdentityAlias(kind='LEGACY_STUDENT_REF')` during migration, then resolved to `studentUserId`
- `actorRef` -> either:
  - `actorUserId` if it resolves to a real user
  - `actorKind='AI' | 'SYSTEM' | 'LEGACY'` plus `actorRefRaw` if not

Canonical DB tables should use user foreign keys where possible. Raw refs are transitional lineage aids, not the long-term source of truth.

## Course membership model v1

### Recommended roles

Use one `CourseMembership` row per user per course with role enum:

- `COURSE_ADMIN`
- `LECTURER`
- `STUDENT`

This supports multi-staff courses in v1 without introducing TA/grader complexity yet.

### Recommended statuses

Use membership status enum:

- `INVITED`
- `ACTIVE`
- `SUSPENDED`
- `REMOVED`

`ACTIVE` drives normal permissions. `REMOVED` and `SUSPENDED` block new access without deleting history.

## Ownership and relation map

Use these ownership rules:

- `Course` owns:
  - `CourseMembership`
  - `Week`
  - `CourseMaterial`
  - `Assignment`
  - `ExamBatch`
  - `Submission`
  - `Review`
  - `PublishedResult`
  - `GradebookEntry`
  - `Flag`
  - most `AuditEvent` rows
- `Assignment` belongs to one `Course` and one `Week`
- `ExamBatch` belongs to one `Course`
- `Submission` belongs to one `Course`, one student user, and exactly one module origin:
  - `Assignment`
  - `ExamBatch`
- `Review` belongs to one `Submission`
- `ReviewVersion` belongs to one `Review`
- `PublishedResult` belongs to one `Submission`, one `Review`, one student user, and one module origin
- `GradebookEntry` belongs to one student user, one course, and one module origin and points to the current effective `PublishedResult`
- `Flag` belongs to one course and one scope anchor
- `AuditEvent` belongs to an aggregate and should carry `courseId` whenever the aggregate is course-owned

## Permission matrix v1

### Super Admin

`SUPER_ADMIN` can:

- read and manage all courses
- inspect all memberships
- inspect all submissions, reviews, published results, flags, and audit events
- perform operational repair and support actions

### Course Admin

`COURSE_ADMIN` can, within their course:

- manage course metadata
- manage memberships
- create and manage assignments and exam batches
- view and edit reviews
- publish results
- view flags, gradebook, and course analytics/export surfaces

### Lecturer

`LECTURER` can, within their course:

- create and manage assignments and exam batches
- view submissions
- view and edit reviews
- publish results
- view flags and course-level gradebook/export surfaces

`LECTURER` does not manage course staff or course-admin permissions in v1.

### Student

`STUDENT` can, within their course:

- view course assignments and exams that are intended for students
- create or upload their own submissions when the workflow allows
- view only their own current and historical published outcomes
- view their own gradebook surfaces

Students cannot access internal reviews, review versions, staff flags, or unpublished results.

## Query patterns and read-model strategy

### Materialized data

Materialize and store directly:

- `ReviewVersion`
- `PublishedResult`
- `GradebookEntry`
- `Flag`
- `AuditEvent`

`GradebookEntry` is the main read model for current score surfaces.

### Computed on demand

Compute on demand from relational tables:

- student course average
  - aggregate `GradebookEntry` for `courseId + studentUserId`
- course average
  - aggregate `GradebookEntry` for `courseId`
- assignment average
  - aggregate `GradebookEntry` for `moduleType='ASSIGNMENT' + assignmentId`
- list of published results for one student in one course
  - query `PublishedResult` with `courseId + studentUserId + status='effective'`
- lecturer view of flagged submissions in one course
  - query `Flag` with `courseId + status='open'`, join `Submission` or `Review`
- review history for one submission
  - query `ReviewVersion` by `reviewId`, order by `createdAt`
- latest effective published result for one submission
  - use `Submission.currentPublishedResultId` as the fast path
- exam batch result listing and export preparation
  - query `GradebookEntry` + `PublishedResult` + `Submission` filtered by `examBatchId`

### Why this split fits this repo

This repo needs rich relational queries and stable published-state lineage. Materializing only the current gradebook view keeps averages cheap while leaving historical truth in `PublishedResult`.

## Indexing strategy

Recommended indexes:

- `AuthAccount`: unique `(provider, providerAccountId)`
- `IdentityAlias`: unique `(kind, normalizedValue)`
- `CourseMembership`: unique `(courseId, userId)`, plus indexes on `(courseId, role, status)` and `(userId, status)`
- `Week`: unique `(courseId, ordinal)`
- `Assignment`: index `(courseId, weekId, state)`, index `(courseId, deadlineAt)`
- `ExamBatch`: index `(courseId, state, createdAt desc)`
- `Submission`: index `(courseId, studentUserId, submittedAt desc)`, index `(assignmentId, studentUserId, submittedAt desc)`, index `(examBatchId, studentUserId, submittedAt desc)`, unique nullable `legacyJobId`
- `Review`: unique `(submissionId)`
- `ReviewVersion`: index `(reviewId, createdAt desc)`
- `PublishedResult`: index `(submissionId, publishedAt desc)`, index `(courseId, studentUserId, publishedAt desc)`, index `(assignmentId, studentUserId)` and `(examBatchId, studentUserId)`
- `GradebookEntry`: unique `(courseId, studentUserId, moduleType, assignmentId, examBatchId)` implemented with module-specific uniqueness strategy, plus index `(courseId, studentUserId)` and `(courseId, publishedAt desc)`
- `Flag`: index `(courseId, status, severity)`, index `(submissionId)`, index `(reviewId)`
- `AuditEvent`: index `(aggregateType, aggregateId, occurredAt desc)`, index `(courseId, occurredAt desc)`

Important PostgreSQL/Prisma note:

- Prisma cannot express every check constraint or partial unique index needed here.
- Use Prisma schema for the base model and raw SQL migrations for:
  - polymorphic module check constraints
  - optional partial uniqueness where needed
  - any DB-level invariant Prisma cannot encode

## Latest-effective published result rule

Use two layers of enforcement:

### Application rule

The publish transaction must:

1. append a `published_snapshot` review version
2. mark prior `PublishedResult` rows for the submission as `superseded`
3. insert the new `PublishedResult` as `effective`
4. update `Submission.currentPublishedResultId`
5. upsert the current `GradebookEntry`

### Persistence rule

Persist:

- `Submission.currentPublishedResultId` as the authoritative pointer to the current effective result
- `PublishedResult.status` as historical lineage state
- `GradebookEntry` as the current-only projection from the effective result

This keeps historical truth and current-read efficiency separate.

## Migration strategy from file-backed storage and opaque refs

### Migration order

1. Stand up Prisma schema and Postgres repository package
2. Introduce identity and membership tables
3. Import course and lecture data into:
   - `Course`
   - `StoredAsset`
   - `CourseMaterial`
4. Import review-side data into:
   - `Submission`
   - `Review`
   - `ReviewVersion`
5. Resolve `studentRef` and `actorRef` through `IdentityAlias`
6. Introduce `PublishedResult` and `GradebookEntry` for migrated or published data
7. Flip one runtime seam to DB-backed reads/writes while keeping legacy HTTP shape

### File-backed mapping guidance

Map current file-backed records like this:

- `JobRecord.id` -> `Submission.legacyJobId`
- `JobRecord.inputs.courseId` -> `Submission.courseId` when present
- review JSON -> `Review` + one or more imported `ReviewVersion` rows
- lecture assets -> `StoredAsset` + `CourseMaterial(kind='lecture_asset')`
- current submission file paths -> `StoredAsset`
- legacy `createdBy='human'|'ai'` -> `actorKind` and possibly `actorRefRaw`

### Opaque ref migration guidance

Do not keep `studentRef` and `actorRef` as canonical DB foreign keys.

Instead:

- import legacy refs into `IdentityAlias`
- resolve aliases to `User`
- store canonical user FKs in operational tables
- keep raw legacy refs only where needed for audit lineage or unresolved imports

## Recommended first runtime adoption seam

Recommended first runtime adoption seam:

- the existing review API surface in `apps/web`, starting with:
  - `GET /api/reviews/[jobId]`
  - then `PUT` / `PATCH` in the same route once reads are stable

Why this seam:

- it has low blast radius
- it already exists
- it aligns with `Review`, `ReviewVersion`, and the publish-boundary model
- it does not require immediate worker migration
- it can preserve the current HTTP shape while moving persistence behind the route

Use `Submission.legacyJobId` as the bridge from current route params to DB-backed review records.

## Exact future implementation file plan for the next coding milestone

Recommended future implementation package and files:

### Shared Postgres package

- `packages/postgres-store/package.json`
- `packages/postgres-store/prisma/schema.prisma`
- `packages/postgres-store/prisma/migrations/**`
- `packages/postgres-store/src/client.ts`
- `packages/postgres-store/src/repos/*.ts`
- `packages/postgres-store/src/mappers/*.ts`
- `packages/postgres-store/src/queries/*.ts`
- `packages/postgres-store/src/index.ts`
- `packages/postgres-store/scripts/import-file-backed.ts`

### Minimal app integration

- `apps/web/src/lib/server/persistence.ts`
- `apps/web/src/app/api/reviews/[jobId]/route.ts`

Only that review route should be the first runtime seam. Do not expand to jobs, exams, courses, or worker runtime in the same slice.

### Optional domain touchpoints

Only touch `@hg/domain-workflow` if implementation exposes a concrete contract mismatch. Otherwise keep it unchanged.

## Validation and acceptance criteria for the future implementation milestone

Validation commands to add for the future implementation milestone:

- `pnpm --filter @hg/postgres-store build`
- `pnpm --filter @hg/postgres-store test`
- Prisma validation and generation commands from that package
- `pnpm --filter web build`
- `pnpm --filter worker build`

Acceptance criteria for that future coding milestone:

- Prisma schema models match the domain foundation mappings in this plan
- repository implementations exist for the first adopted aggregates
- file-backed import script can ingest representative local data without schema mismatch
- `GET /api/reviews/[jobId]` keeps its current HTTP shape
- no worker runtime changes are introduced
- no broader runtime adoption beyond the first review seam is introduced
- DB transactions enforce publication and gradebook projection invariants

## Risks / open questions

- The current architecture doc still describes Firebase or Firestore as long-term target direction; that broader platform direction must not override the now-chosen Postgres + Prisma persistence path for this milestone.
- The exact distinction between `COURSE_ADMIN` and `LECTURER` capabilities may need tightening when the first authorization middleware is designed.
- Historical file-backed data may not contain enough identity information to resolve every legacy `studentRef` directly to a user without an alias-import step.
- Some DB constraints required by the domain model will need raw SQL migrations because Prisma schema DSL is not sufficient by itself.
- Analytics snapshots, notifications, and export persistence remain intentionally out of the first DB implementation slice.
- Whether Auth.js eventually persists into the same Postgres schema or remains loosely coupled is still an open integration detail.

## Definition of done

This design milestone is done when:

- the Postgres + Prisma direction is fully specified for the current domain foundation,
- identity, course membership, ownership, and permission skeletons are explicit,
- `studentRef` and `actorRef` migration is explained concretely,
- query strategy is explicit for the required use cases,
- indexing and latest-effective publication rules are explicit,
- a low-risk first runtime adoption seam is chosen,
- the next coding milestone can be implemented without making new architectural decisions.
