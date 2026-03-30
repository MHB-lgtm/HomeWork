# Postgres + Prisma Persistence & Identity Design

Status: approved design direction and still the source of truth for rollout beyond the current review, publication, and published-lens slices
Last updated: 2026-03-27

## 1. Goal

Define how the existing domain foundation should map to PostgreSQL, Prisma, identity, memberships, and course-scoped ownership before broader committed runtime adoption continues.

This design must be precise enough that the next coding milestone can implement the first DB slice without making new architectural decisions mid-flight.

## 2. Non-goals

This design does not itself implement the wider product migration. The current branch now has narrow committed review and publication slices, including a lecturer-facing published lens inside `/reviews`, but broader rollout decisions still come from this document.

This design does not itself implement:

- broad runtime adoption in `apps/web` or `apps/worker` beyond the current narrow review/publication slices
- worker migration
- UI changes
- final analytics, notification, or export systems
- changes to `@hg/domain-workflow` unless a real mismatch is discovered during implementation

## 3. Current implemented foundation summary

The committed baseline already has:

- `@hg/domain-workflow` with canonical entities, states, repository interfaces, services, and projections
- explicit publish-boundary contracts:
  - `Review`
  - `ReviewVersion`
  - `PublishedResult`
  - `GradebookEntry`
- file-backed local stores still active
- narrow committed DB-backed review/publication runtime in `apps/web`
- narrow committed lecturer-facing publication read-side in `/reviews`
- no committed user, membership, or authz runtime

Future persistence milestones must build on that foundation rather than redesign it.

## 4. Design principles for this repo

- PostgreSQL is the approved operational data store direction.
- Prisma is the default schema/client layer, with raw SQL migrations for invariants Prisma cannot express.
- `@hg/domain-workflow` remains storage-agnostic.
- Postgres-specific repositories belong in a separate package, not in the domain package.
- Course-scoped authorization remains central to relation design, so course-owned rows keep a direct `courseId` column even when derivable.
- Raw legacy payloads and snapshots belong in `jsonb`; query-critical fields belong in explicit relational columns.
- Background worker runtime remains unchanged in the first DB slice.
- Current HTTP shapes should stay stable during narrow runtime seams.

## 5. Recommended package and schema direction

Recommended new shared package:

- `packages/postgres-store`
- package name: `@hg/postgres-store`

That package should own:

- `prisma/schema.prisma`
- raw SQL migrations
- Prisma client setup
- Postgres repository implementations
- DB/domain mappers
- import tooling from file-backed data

## 6. Prisma schema v1 recommendation

### 6.1 First-slice models

Required first-slice models:

- `User`
- `IdentityAlias`
- `Course`
- `CourseMembership`
- `StoredAsset`
- `CourseMaterial`
- `Submission`
- `Review`
- `ReviewVersion`
- `PublishedResult`
- `GradebookEntry`

Optional later models:

- `AuthAccount`
- `Flag`
- `AuditEvent`
- `Week`
- `Assignment`
- `ExamBatch`

### 6.2 Column conventions

- UUID primary keys for DB rows
- `timestamptz` timestamps
- `Decimal` for scores
- `jsonb` for raw payloads and snapshots
- enums where the domain already has fixed variants

### 6.3 Transitional external identifiers

Use dedicated transitional external-lookup columns instead of overloading primary keys:

- `Course.legacyCourseKey` nullable unique
- `Submission.legacyJobId` nullable unique

`legacyJobId` is transitional only. It exists to bridge imported file-backed review/job history and the initial review-route seam.

Long-term canonical external lookup should move to domain-owned identifiers such as:

- `submissionId`
- `reviewId`
- `publishedResultId`

## 7. Identity model v1

### 7.1 Canonical identity

Use a provider-agnostic identity model:

- `User` is the canonical person record
- `IdentityAlias` maps legacy or institutional identifiers to a `User`

If `AuthAccount` is later added, it links provider identities to `User`, but it is not required for the first persistence slice.

### 7.2 Global roles

Global roles should stay minimal:

- `USER`
- `SUPER_ADMIN`

`LECTURER` and `STUDENT` are course-scoped and belong in memberships, not as global roles.

### 7.3 Unresolved legacy identity behavior

The import path must not silently invent canonical users.

If `studentRef` or `actorRef` cannot be resolved:

- keep the raw legacy value for lineage
- record the unresolved mapping in the import report
- allow placeholder unresolved references only where the design explicitly permits them
- do not pretend the unresolved value is a canonical `User` foreign key

Recommended behavior:

- `studentRef`
  - unresolved import may use a nullable `studentUserId`
  - raw source value is retained through `IdentityAlias` or import reporting
- `actorRef`
  - unresolved values remain raw lineage only via fields like `actorRefRaw` and `actorKind`

Hard-fail only when a required canonical relation cannot legally be nullable for the specific row being imported.

## 8. Course membership model v1

Recommended `CourseMembership` roles:

- `COURSE_ADMIN`
- `LECTURER`
- `STUDENT`

Recommended membership statuses:

- `INVITED`
- `ACTIVE`
- `SUSPENDED`
- `REMOVED`

This keeps course-scoped authorization central without mixing role logic into grading-domain entities.

## 9. Ownership and relation map

Use these ownership rules:

- `Course` owns:
  - `CourseMembership`
  - `CourseMaterial`
  - `Submission`
  - `Review`
  - `PublishedResult`
  - `GradebookEntry`
- `Submission` belongs to one course and one student user when resolved
- `Review` belongs to one submission
- `ReviewVersion` belongs to one review
- `PublishedResult` belongs to one submission and one review
- `GradebookEntry` points to the current effective `PublishedResult`

Future ownership for `Assignment` / `ExamBatch` remains canonical, but those tables may be deferred depending on the first slice.

## 10. Permission matrix skeleton

### `SUPER_ADMIN`

- system-wide operational access

### `COURSE_ADMIN`

- manage course metadata and memberships
- manage reviews and publication within the course

### `LECTURER`

- view submissions and reviews in the course
- edit reviews and publish results in the course

### `STUDENT`

- view only their own published outcomes and future student-facing course surfaces

This is a permission skeleton, not an implemented authz layer.

## 11. Repository contract map

Future Postgres implementations should map to `@hg/domain-workflow` interfaces as follows.

### First slice

- `CourseRepository`
  - Postgres implementation needed for course lookup/import support
- `MaterialRepository`
  - Postgres implementation needed for stored course and submission assets
- `SubmissionRepository`
  - first-slice repository
  - required methods:
    - `getSubmission`
    - `saveSubmission`
    - legacy-job lookup helper outside the domain interface as needed
- `ReviewRepository`
  - first-slice repository
  - required methods:
    - `getReview`
    - `getReviewBySubmissionId`
    - `saveReview`
    - `appendReviewVersion`
    - `listReviewVersions`
    - `setCurrentReviewVersion`
- `PublicationRepository`
  - first-slice repository used by the current narrow publish path
  - broader publication and gradebook surfaces remain future work

### Deferred

- `WeekRepository`
- `AssignmentRepository`
- `ExamBatchRepository`
- `FlagRepository`
- `AuditRepository`

Those remain intentionally deferred until their runtime slice is approved.

## 12. Query patterns and read-model strategy

Materialize directly:

- `ReviewVersion`
- `PublishedResult`
- `GradebookEntry`

Compute on demand:

- student course average
- course average
- assignment average
- student published-results listing per course
- review history per submission
- exam-batch export/query surfaces

Fast-path rule:

- `Submission.currentPublishedResultId` is the authoritative pointer to the current effective published result

Historical rule:

- `PublishedResult.status` preserves historical lineage
- `GradebookEntry` is the current read model only

## 13. Publish concurrency and locking policy

Publication is a multi-row invariant and must be transactionally protected.

Current branch note:

- a narrow imported-review publish route now exists
- the current lecturer-facing publication read surface is still `/reviews` only
- this section remains the source of truth for stronger concurrency guarantees in broader rollout

Recommended policy:

- use a transaction
- lock the submission row pessimistically for publish operations
- re-read current effective publication state inside the transaction
- append the published snapshot review version
- supersede prior effective results
- insert the new effective published result
- update `Submission.currentPublishedResultId`
- upsert the current `GradebookEntry`

Why pessimistic locking:

- publish is low-frequency and high-integrity
- the invariant spans multiple rows
- it is clearer and safer than relying only on optimistic retries

Secondary guard:

- also enforce a partial unique index so only one `effective` `PublishedResult` can exist per submission

Failure behavior on conflict:

- lock timeout or conflicting concurrent publish should surface as an explicit conflict/retryable failure
- do not silently create multiple effective results

## 14. GradebookEntry uniqueness strategy

Canonical rule:

- exactly one of `assignmentId` or `examBatchId` must be set for a canonical gradebook row

Required DB checks:

- `assignmentId IS NOT NULL AND examBatchId IS NULL`
  - when the row represents an assignment module
- `assignmentId IS NULL AND examBatchId IS NOT NULL`
  - when the row represents an exam-batch module

Recommended DB enforcement:

- a `CHECK` constraint for the one-of rule
- a `CHECK` constraint or enum parity rule tying module kind to the populated foreign key
- partial unique indexes, or equivalent raw SQL, for:
  - `(courseId, studentUserId, assignmentId)` where `assignmentId IS NOT NULL`
  - `(courseId, studentUserId, examBatchId)` where `examBatchId IS NOT NULL`

This is stricter and clearer than a single nullable composite unique constraint.

## 15. Latest-effective published-result rule

The persistence model must enforce two things:

1. historical lineage
2. one current effective result

Required rule:

- only one `PublishedResult` may be `effective` per submission
- all older effective rows become `superseded`
- `Submission.currentPublishedResultId` must point at the current effective row
- `GradebookEntry` must reflect only that effective row

## 16. Import strategy from file-backed storage

### 16.1 Required import behavior

`import-file-backed.ts` must be:

- idempotent
- rerunnable
- safe for dry-run mode
- explicit in its reporting

### 16.2 Required CLI behavior

Recommended flags:

- `--data-dir <path>`
- `--dry-run`
- optional mapping manifest flags such as:
  - `--identity-map <path>`
  - `--course-map <path>`

### 16.3 Required reporting

The import must emit a clear report with counts for:

- imported
- updated
- skipped
- unresolved
- failed

The report should be machine-readable enough for iteration, for example JSON output or a saved report file.

### 16.4 Legacy mapping manifests

If legacy data needs human-guided reconciliation:

- use explicit mapping manifests
- treat them as optional inputs
- unresolved rows should be reported rather than silently discarded
- unresolved identity or ownership should not be hidden behind fake canonical IDs

### 16.5 Legacy mapping guidance

Representative mappings remain:

- `JobRecord.id` -> `Submission.legacyJobId`
- review JSON -> `Review` + `ReviewVersion`
- lecture assets -> `StoredAsset` + `CourseMaterial`
- submission file paths -> `StoredAsset`

## 17. Recommended first runtime adoption seam

The originally approved first DB-backed runtime seam was:

- `GET /api/reviews/[jobId]`

Why:

- low blast radius
- already exists
- aligns with `Review` / `ReviewVersion`
- can preserve the current HTTP response shape
- does not require worker migration

Bridge strategy:

- `Submission.legacyJobId` is the transitional lookup bridge only

Current branch note:

- `GET /api/reviews/[jobId]` is now implemented
- `PUT` / `PATCH /api/reviews/[jobId]` are also DB-aware for imported reviews
- `GET /api/reviews` is now a narrow hybrid read-side extension with publication summary for effective imported results
- `GET /api/reviews/[jobId]/submission` and `/submission-raw` now serve imported assets through review-centric APIs
- `POST /api/reviews/[jobId]/publish` now exposes a narrow imported-review publication mutation
- `/reviews` now acts as the current lecturer-facing published lens inside the existing review surface
- the rest of the product still remains outside this rollout

## 18. Tighter acceptance criteria for the next coding milestone

The next coding milestone should be accepted only if:

- `@hg/postgres-store` exists
- Prisma schema and raw SQL migrations exist for the approved first slice
- repository implementations map cleanly to `@hg/domain-workflow`
- `import-file-backed.ts` is idempotent
- `import-file-backed.ts` supports dry-run
- `import-file-backed.ts` emits imported/skipped/unresolved/failed reporting
- no worker runtime changes are introduced
- the committed HTTP shape of `GET /api/reviews/[jobId]` is preserved
- runtime adoption stays narrow and does not spread to unrelated routes
- `@hg/domain-workflow` stays unchanged unless a real contract mismatch is discovered
- Windows developer workflows are supported for commands and scripts where relevant

## 19. Validation expectations for the next coding milestone

Expected commands:

- `pnpm --filter @hg/postgres-store build`
- `pnpm --filter @hg/postgres-store test`
- `pnpm --filter @hg/postgres-store prisma:validate`
- `pnpm --filter @hg/postgres-store prisma:generate`
- `pnpm --filter web build`
- `pnpm --filter worker build`

Windows note:

- commands and scripts should work in PowerShell
- if `pnpm.ps1` is blocked, `pnpm.cmd` should be documented as the fallback

## 20. Open questions

- Whether `AuthAccount` is needed in the first DB slice or can wait
- How quickly unresolved legacy identities must be reconciled after import
- Whether imported historical data without canonical assignment/exam ownership should create gradebook rows immediately or only after ownership reconciliation
- How the future auth/session milestone should attach to the canonical Postgres identity model

## 21. Definition of done

This design is done when:

- the Postgres + Prisma direction is explicit and grounded in this repo
- publish concurrency policy is explicit
- `GradebookEntry` uniqueness strategy is explicit
- unresolved legacy identity behavior is explicit
- repository-interface mapping is explicit
- `import-file-backed.ts` requirements are explicit
- transitional vs canonical external identifiers are explicit
- the next coding milestone can be implemented without reopening architectural questions
