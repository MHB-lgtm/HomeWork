# Homework Grader Architecture

Last updated: 2026-03-23
Status: canonical architecture document for this repository
Scope: current implementation, target product architecture, gap analysis, and phased migration path

## 1. Executive Summary

This repository currently implements a monorepo-based grading system with:

- `apps/web` as the main Next.js App Router application for UI and HTTP APIs.
- `apps/worker` as the background worker for grading and exam indexing jobs.
- `packages/domain-workflow` as a storage-agnostic domain foundation package for canonical workflow contracts.
- file-backed persistence under `HG_DATA_DIR`.
- no production database, no ORM, and no implemented authentication layer.

The current system is exam-first and review-first. It can upload exams, index questions, create grading jobs, process jobs in a worker, persist review records, and optionally attach course study pointers from a file-backed RAG index. It now also has a storage-agnostic domain foundation layer, but runtime adoption of that layer is still zero by design. The product does not yet implement a course-centric academic platform with students, course memberships, weekly assignments, published results, analytics, notifications, or full audit trails.

The target product architecture is materially broader:

- the product becomes course-centric rather than exam-centric,
- each course is managed by its own lecturer or course admin,
- students can belong to multiple courses,
- the system supports two academic modules: Assignments and Exams,
- results are reviewed, published, audited, exported, and surfaced back to students through a learning dashboard.

Near-term architecture work is narrower than the full target vision. The approved near-term authentication foundation is Auth.js inside `apps/web`. The longer-term product platform direction from the product spec points to Firebase Auth, Firestore, Storage, Functions/Jobs/Triggers, and notifications. That target platform is not implemented in this repository today and should not be treated as current state.

## 2. Current Repository Architecture (As-Is)

### 2.1 Repository shape

This repository is a pnpm monorepo:

```text
HomeWork/
|-- apps/
|   |-- web/                       # Next.js App Router app
|   `-- worker/                    # Background worker and scripts
|-- packages/
|   |-- shared-schemas/            # Shared Zod schemas and TS types
|   |-- domain-workflow/           # Canonical domain entities, rules, and projections
|   |-- local-job-store/           # File-backed job/review/exam-index persistence
|   `-- local-course-store/        # File-backed course/lecture/RAG persistence
|-- scripts/
|-- data/                          # Local runtime data root when HG_DATA_DIR points here
|-- ARCHITECTURE.md
`-- pnpm-workspace.yaml
```

Workspace definition:

- `pnpm-workspace.yaml` includes `apps/*` and `packages/*`.

### 2.2 Runtime components

#### `apps/web`

`apps/web` is the main product application.

- Framework: Next.js App Router
- Responsibilities:
  - render the current UI routes,
  - expose product APIs under `apps/web/src/app/api/**`,
  - write uploaded files to the local data directory,
  - create exam and grading records through local store packages.

Current page routes:

- `/`
- `/exams`
- `/rubrics`
- `/reviews`
- `/reviews/[jobId]`
- `/courses`
- `/courses/[courseId]`

Current API route groups:

- `apps/web/src/app/api/exams/**`
- `apps/web/src/app/api/jobs/**`
- `apps/web/src/app/api/reviews/**`
- `apps/web/src/app/api/rubrics/**`
- `apps/web/src/app/api/courses/**`
- `apps/web/src/app/api/health/route.ts`

#### `apps/worker`

`apps/worker` is the background worker.

- Responsibility:
  - claim pending grading jobs,
  - run grading and localization pipelines,
  - write results and review annotations,
  - generate exam indices,
  - optionally attach study pointers from the course RAG index.

Important operational detail:

- `pnpm --filter worker job:run-loop` is the actual queue loop.
- `pnpm --filter worker start` runs `dist/index.js`, which is not the queue loop and should not be treated as the production worker entrypoint.

#### Shared packages

`packages/shared-schemas`

- canonical Zod schemas and TypeScript contracts for grading, reviews, courses, and exam index artifacts.

`packages/domain-workflow`

- storage-agnostic canonical domain entities, lifecycle models, repository contracts, services, and gradebook publication rules.
- currently used as a foundation package only; it is not wired into `apps/web` or `apps/worker` runtime flows yet.

`packages/local-job-store`

- file-backed job queue, review persistence, and exam index persistence.
- includes thin adapters that map current file-backed review and asset data into domain-workflow contracts.

`packages/local-course-store`

- file-backed course, lecture, and RAG index persistence.
- includes thin adapters that map current course and lecture assets into domain-workflow contracts.

### 2.3 Current persistence model

The current system is file-backed. There is no production database or ORM layer.

Primary data root:

- `HG_DATA_DIR`

Current persisted data layout:

```text
<HG_DATA_DIR>/
|-- uploads/
|   |-- <job file copies>
|   `-- derived/<jobId>/questions/<questionId>.pdf
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

### 2.4 Current domain shape

The current repo has the following durable first-class concepts:

- `Exam`
- `ExamIndex`
- `Rubric`
- `JobRecord`
- `ReviewRecord`
- `Course`
- `Lecture`
- `RagManifest` and lexical RAG chunks

Important absences in current state:

- no `User` model,
- no `Course Membership`,
- no `Week`,
- no `Assignment`,
- no first-class `Submission` entity,
- no first-class `Exam Batch`,
- no first-class `Flag`,
- no first-class `Audit Event`,
- no first-class `Analytics Snapshot`,
- no implemented roles or authorization boundaries.

The repo now also contains canonical domain definitions for these concepts in `packages/domain-workflow`, but those definitions are not yet the active runtime persistence model.

### 2.5 Current grading system behavior

Current grading is job-oriented, not course-lifecycle-oriented.

- A grading run is represented by a `JobRecord` in `packages/local-job-store/src/types.ts`.
- A student submission currently exists as a file path inside job inputs, not as a durable domain entity with history or publish state.
- A review currently exists as a `ReviewRecord` in `packages/shared-schemas/src/review/v1/schemas.ts`.
- Review records contain `jobId`, `displayName`, timestamps, and `annotations[]`.
- Annotation `createdBy` currently distinguishes `'human'` and `'ai'`; it is not a user identity model.
- Publish-boundary concepts such as `ReviewVersion`, `PublishedResult`, and `GradebookEntry` now exist in `packages/domain-workflow`, but they are not yet persisted or exposed through runtime APIs.

### 2.6 Current auth and security state

Current state is unauthenticated.

- No auth/session middleware is implemented.
- Product APIs currently accept requests without login.
- Sensitive routes such as job creation, raw submission access, exam upload, review mutation, and course index rebuild are currently open at the HTTP layer.

Near-term approved direction:

- Auth.js in `apps/web` as the first authentication foundation.

That direction is planned but not yet implemented in the current runtime.

## 3. Target Product Architecture (To-Be)

### 3.1 Product shape

The target product is course-centric.

- A `Course` is the primary academic container.
- Each `Course` is managed by one or more lecturers or course admins.
- A student can belong to multiple courses through `Course Membership`.
- Each course exposes two academic modules:
  - `Assignments`
  - `Exams`

The target product is not just a grading console. It is a course operations and student learning platform.

### 3.2 Target runtime architecture

The target platform direction from the product spec is:

- Firebase Auth
- Firestore
- Storage
- Functions / Jobs / Triggers
- Notifications

The intended architectural shape is:

- web application surface for lecturer and student workflows,
- centralized identity service,
- persistent operational data store,
- object storage for uploaded academic files,
- background job execution for grading, analytics, notifications, and exports,
- explicit audit and publication boundaries.

This should not be read as already implemented. It is the target platform direction.

### 3.3 Target academic modules

#### Assignments module

Assignments are course-week scoped.

- Lecturer creates weekly assignments inside a `Week`.
- Each assignment has:
  - open date,
  - deadline,
  - assignment file,
  - model solution or evaluation source,
  - optional rubric or grading instructions.
- Students download assignments and upload PDF submissions.
- Resubmission is allowed until the deadline.
- No grading happens before the deadline.
- At deadline, an automated grading job runs for the final effective submission.
- Lecturer reviews and can edit the result.
- Students see only published results.

#### Exams module

Exams are lecturer-operated batch workflows.

- Lecturer uploads:
  - original exam,
  - model solution,
  - folder or batch of student submissions.
- The system processes the batch and produces:
  - final grades,
  - per-question breakdown,
  - flags,
  - class analytics,
  - exportable outputs.

### 3.4 Target user experiences

#### Student experience

Students should have:

- assignment list and statuses,
- final scores,
- technical feedback,
- per-question breakdown,
- general summary,
- learning recommendations,
- personal dashboard with:
  - progress over time,
  - strengths and weaknesses,
  - weak topics,
  - previous grades,
  - submission status comparison.

#### Lecturer experience

Lecturers should have:

- course management,
- weekly assignment structure,
- submissions viewer,
- edit and approve results,
- flagged-submission filtering,
- analytics by week, assignment, and course,
- score distribution,
- hard-question analysis,
- common-error analysis,
- weakest-student analysis,
- weak-topic and weak-question analysis.

## 4. Core Domains and Entities

### 4.1 Canonical terminology

This document uses the following normalized terms:

- `Course`
- `Course Membership`
- `Week`
- `Assignment`
- `Submission`
- `Review`
- `Exam Batch`
- `Flag`
- `Audit Event`
- `Audit Trail`
- `Analytics Snapshot`

### 4.2 Core entity model

| Entity | Purpose | Current repo status | Target status |
| --- | --- | --- | --- |
| `Course` | Academic container owned by lecturers/admins | Exists in minimal form | Remains core aggregate |
| `Course Membership` | Links users to a course with role and status | Missing | Required |
| `Week` | Organizes assignments inside a course timeline | Missing | Required |
| `Assignment` | Weekly task definition with dates and source files | Missing | Required |
| `Submission` | Student attempt against an assignment | Not first-class; currently only a job input file | Required |
| `Review` | Human-editable result and annotation surface | Exists, but limited | Required with richer states and audit |
| `Exam Batch` | Lecturer-operated bulk exam processing unit | Missing | Required |
| `Flag` | AI, lecturer, or rule-generated issue marker | Missing as first-class entity | Required |
| `Audit Event` | Immutable event for result lineage | Missing | Required |
| `Analytics Snapshot` | Materialized aggregate metrics | Missing | Required |

### 4.3 Supporting grading artifacts

The target model also needs explicit support for grading artifacts that are only partially modeled today:

- exam source document,
- model solution,
- rubric,
- question map / parsed structure,
- grading configuration,
- export artifact.

Current state:

- `Exam`, `ExamIndex`, and `Rubric` exist.
- model solution is not consistently modeled as a distinct persistent entity.
- exports are not modeled.

### 4.4 Lifecycle states

Recommended target lifecycle states:

| Entity | Target lifecycle |
| --- | --- |
| `Assignment` | `draft -> open -> closed -> processing -> reviewed -> published` |
| `Submission` | `uploaded -> superseded -> queued -> processed -> lecturer-edited -> published` |
| `Exam Batch` | `uploaded -> processing -> reviewed -> exported` |

These states are not currently implemented as durable state machines in the repo.

## 5. Roles and Authorization Model

### 5.1 Roles

Target roles:

- `Student`
- `Lecturer`
- `Super Admin`

### 5.2 Authorization principles

Authorization should be course-scoped by default.

- Lecturer authority is not global by default.
- A lecturer should act only within courses where they have lecturer or admin membership.
- A student should access only their own course memberships, submissions, and published outcomes.
- `Super Admin` is the only role with system-wide operational authority.

### 5.3 Separation of concerns

Authentication and authorization must remain separate from grading domain logic.

- auth identifies the caller,
- authorization resolves whether that caller can read or mutate a specific course-scoped resource,
- grading services operate on authorized domain work items and should not contain user-facing access decisions.

### 5.4 Current state versus target state

Current repository state:

- no implemented `User` entity,
- no implemented course memberships,
- no implemented auth layer,
- no role enforcement.

Near-term state:

- Auth.js in `apps/web` to establish login/session boundaries.

Longer-term target direction:

- Firebase Auth or an explicitly chosen converged identity model that supports the course-scoped authorization layer.

## 6. End-to-End Flows

### 6.1 Assignment flow

Target flow:

1. Lecturer creates a `Course`.
2. Lecturer configures `Week` structures.
3. Lecturer creates an `Assignment` inside a week.
4. Lecturer uploads the assignment file and grading source material.
5. Assignment opens at the configured open date.
6. Student downloads the assignment and uploads a PDF `Submission`.
7. Student may resubmit until the deadline.
8. At deadline, the system identifies the final active submission per student.
9. Automated grading runs after deadline, not before it.
10. The grading pipeline performs OCR/parsing, question-level analysis, comparison to model solution, scoring, feedback generation, and flag generation.
11. Lecturer reviews the `Review`, edits scores or feedback if needed, and approves publication.
12. Only after publish does the student see the final result.

Current repository coverage:

- only a partial subset exists,
- there is no `Assignment`,
- there is no deadline-triggered release model,
- there is no publish boundary for student visibility,
- there is no student-facing workflow.

### 6.2 Exam flow

Target flow:

1. Lecturer creates or selects a `Course`.
2. Lecturer uploads:
  - original exam,
  - model solution,
  - folder or batch of student submissions.
3. System creates an `Exam Batch`.
4. Batch processing runs OCR/parsing, question mapping, per-question scoring, flags, and aggregate metrics.
5. Lecturer reviews the batch, adjusts individual results where needed, and exports outputs.
6. System provides:
  - final grades,
  - per-question breakdown,
  - flags,
  - class analytics,
  - export files.

Current repository coverage:

- current grading is mostly single-submission job processing,
- `POST /api/jobs` creates one grading job at a time,
- there is no first-class `Exam Batch`,
- there is no batch-level review workflow,
- there is no class analytics or export subsystem.

### 6.3 Student learning flow

Target flow:

1. Student signs in and lands in a personal dashboard.
2. Student sees assignments and exams relevant to their courses.
3. Student sees current statuses, final published scores, per-question breakdowns, summaries, and recommendations.
4. Student tracks performance over time and can compare weak topics, previous grades, and submission outcomes.

Current repository coverage:

- no student identity,
- no student-facing UI,
- no course membership model,
- no personal dashboard,
- no publication boundary separating internal review from student-visible results.

## 7. AI Processing and Review Pipeline

### 7.1 Current pipeline

The current worker pipeline is implemented in `apps/worker` and is job-driven.

Current high-level stages:

1. exam upload and optional exam index generation,
2. job creation through `POST /api/jobs`,
3. queue claim from file-backed `jobs/pending`,
4. grading in `RUBRIC` or `GENERAL` mode,
5. annotation localization,
6. review persistence,
7. optional study pointer attachment.

Current grading characteristics:

- `GENERAL` mode can map pages and evaluate per question using `ExamIndex` when present.
- `RUBRIC` mode grades one question against a rubric.
- annotations are persisted in review records.
- course study pointers are best-effort and non-blocking.

### 7.2 Target pipeline

The target pipeline needs to become domain-aware rather than single-job-oriented.

Target stages for assignments and exams:

1. ingestion and file registration,
2. OCR and parsing,
3. question segmentation and answer mapping,
4. model-solution or rubric comparison,
5. score calculation,
6. flag generation,
7. review record creation,
8. lecturer edits,
9. publication,
10. analytics materialization,
11. notifications and export generation.

### 7.3 Review authority

AI output is not the final published truth.

- AI produces candidate results.
- Lecturer can review and edit.
- Publish creates the student-visible final result.
- The system must preserve both AI output and the lecturer-edited result in the audit trail.

Current repo status:

- worker-generated results exist,
- review annotations can be edited,
- there is not yet a formal publish boundary or immutable published result snapshot.

## 8. Data Architecture

### 8.1 Current file-backed model

Current persistence is local and file-backed.

Properties of the current model:

- simple to inspect and demo,
- easy to run locally,
- low operational complexity,
- no concurrent multi-user guarantees beyond file semantics,
- no relational or document query layer,
- weak fit for role-based course-scoped product growth,
- weak fit for analytics, notifications, and audit-heavy workflows.

Current store coupling:

- route handlers in `apps/web` call local store packages directly,
- worker code also calls the same local store packages directly.

### 8.2 Target persistent model

The target system needs a persistent operational data model that supports:

- users and course memberships,
- assignment and submission histories,
- exam batch processing,
- review and publish state,
- flags and audit events,
- analytics snapshots,
- notifications,
- exports.

Target platform direction from the spec:

- Firestore as the main persistent operational store,
- Storage for uploaded files and derived artifacts,
- Functions / Jobs / Triggers for asynchronous and scheduled execution.

Recommended target logical collections or aggregates:

- `users`
- `courses`
- `courseMemberships`
- `weeks`
- `assignments`
- `submissions`
- `reviews`
- `examBatches`
- `flags`
- `auditEvents`
- `analyticsSnapshots`
- `notifications`
- `exports`

This collection model is a target direction, not an implemented Firestore schema.

### 8.3 Migration principle

Do not migrate directly from file-path-coupled route handlers to full target architecture in one step.

Recommended migration principle:

- first establish auth and request boundaries,
- then isolate storage concerns behind clearer repository/service boundaries,
- then migrate durable state from file-backed storage to the target persistent model.

## 9. Storage and File Handling

### 9.1 Current state

Current file handling is local:

- uploads are written under `HG_DATA_DIR/uploads`,
- exams are stored under `HG_DATA_DIR/exams/<examId>`,
- review JSON lives under `HG_DATA_DIR/reviews`,
- course assets and RAG artifacts live under `HG_DATA_DIR/courses/<courseId>`.

This is workable for local development and demos but not the target product storage model.

### 9.2 Target state

Target file handling should move to object storage with explicit metadata references in the persistent data model.

Target file categories:

- assignment source files,
- model solutions,
- exam source files,
- student submissions,
- OCR/parsing derivatives,
- export bundles,
- notification attachments where applicable.

Storage rules should be authorization-aware and course-scoped.

### 9.3 File lineage requirements

The target system should preserve file lineage:

- original upload,
- latest active submission,
- derived parsed outputs,
- published export outputs.

That lineage is currently only partial and mostly implicit through file paths and timestamps.

## 10. Jobs, Triggers, and Background Processing

### 10.1 Current state

Current job execution is file-queue-driven:

- pending jobs are JSON files,
- worker claims jobs by renaming files,
- result status is persisted in `pending`, `running`, `done`, and `failed` directories,
- worker liveness is exposed through `worker/heartbeat.json` and `/api/health`.

Current background tasks include:

- grading jobs,
- review annotation generation,
- exam indexing,
- optional course RAG rebuild and study pointer attachment.

### 10.2 Target state

The target system needs multiple asynchronous execution patterns:

- deadline-triggered assignment grading,
- exam batch processing,
- analytics materialization,
- export generation,
- notification dispatch,
- maintenance or repair tasks.

Target platform direction:

- Functions / Jobs / Triggers rather than a local file queue as the primary production execution model.

### 10.3 Scheduling principles

Key target rules:

- assignments are not graded before deadline,
- only the latest active submission should be graded unless policy explicitly says otherwise,
- batch exam processing should support lecturer review before export and publication,
- background processing must be idempotent and auditable.

## 11. Notifications and Export

### 11.1 Current state

Current repository state:

- no notification subsystem,
- no export subsystem,
- users currently inspect status via UI polling and review pages.

### 11.2 Target state

Notifications are required.

Required target notification categories:

- assignment opened,
- assignment deadline approaching,
- grading complete and ready for lecturer review,
- published result available to student,
- flag escalation,
- export ready,
- processing failure or operational intervention required.

Export is also required.

Target export categories:

- grade sheets,
- batch exam results,
- per-question breakdowns,
- flag reports,
- analytics snapshots.

Notification channels are still a design decision.

## 12. Audit Trail and Versioning

### 12.1 Target requirement

The audit trail must include:

- AI-generated result,
- lecturer edits,
- timestamps,
- what was ultimately published.

Flags can originate from:

- AI-generated sources,
- lecturer-generated sources,
- rule-generated sources.

### 12.2 Current state

Current repository state is partial:

- `JobRecord` stores timestamps and result payloads,
- `ReviewRecord` stores timestamps and annotations,
- there is no immutable `Audit Event` stream,
- there is no formal version history for lecturer edits,
- there is no published-result snapshot model,
- there is no first-class `Flag` entity.

### 12.3 Target versioning principle

The target system should separate:

- AI draft result,
- reviewer-edited working result,
- published result,
- immutable audit events that explain how the published result was produced.

## 13. Security and Auth Boundaries

### 13.1 Current state

Current repository state is not production-safe from an access-control perspective.

- product pages are not protected,
- product APIs are not protected,
- raw submission access is currently open at the API boundary,
- no user or course-scoped authorization exists.

### 13.2 Near-term direction

Near-term approved direction:

- Auth.js in `apps/web`,
- private-by-default app behavior,
- centralized request boundaries,
- secure server-side protection for sensitive routes and APIs,
- no changes to worker behavior or file-backed stores in the first auth milestone.

### 13.3 Target state

The target product must enforce:

- authenticated users,
- course-scoped authorization,
- student-only access to published personal outcomes,
- lecturer-only access to course management and result editing,
- super-admin access to platform administration,
- secure storage boundaries for academic files,
- service-to-service execution boundaries for background jobs.

### 13.4 Onboarding note

If bulk user onboarding is later introduced, CSV import with generated passwords should not be treated as an approved secure design by default.

Preferred safer direction:

- invitation flows,
- password setup links,
- reset-link onboarding,
- institution-backed identity where available.

Any CSV-plus-generated-password design would require explicit security review.

## 14. Gap Analysis: Current vs Target

| Area | Current repository | Target architecture | Gap |
| --- | --- | --- | --- |
| Product center of gravity | Exam-first, job-first | Course-centric with assignments and exams | Large |
| Identity | No auth implemented | Authenticated platform with role-aware access | Large |
| Authorization | No course memberships or roles | Course-scoped authorization | Large |
| Persistence | File-backed local stores | Persistent data model with Firestore and Storage direction | Large |
| Assignment module | Missing | Full weekly assignment lifecycle | Large |
| Submission model | File path inside job inputs | First-class submission history with publish semantics | Large |
| Exam processing | Single-job flow with exam upload and review | Lecturer-managed exam batch workflow | Large |
| Review lifecycle | Review JSON and annotations only | Review, edit, publish, audit, export | Large |
| Flags | Implicit, not first-class | AI, lecturer, and rule-generated flags | Large |
| Analytics | Minimal or absent | Course, assignment, exam, and student analytics snapshots | Large |
| Notifications | Absent | Required | Large |
| Export | Absent | Required | Large |
| Audit trail | Partial timestamps only | Full audit events and published-result lineage | Large |

## 15. Recommended Phased Roadmap

### Phase 0: Stabilize and document current architecture

Goals:

- maintain the current local file-backed system,
- document actual runtime boundaries,
- keep the worker and grading pipeline understandable and demoable.

### Phase 1: Authentication foundation in `apps/web`

Goals:

- introduce Auth.js in `apps/web`,
- make the app private by default,
- protect sensitive pages and APIs on the server side,
- keep auth separate from grading domain logic,
- keep worker and file-backed stores unchanged.

This phase is near-term and narrower than the full target product architecture.

### Phase 2: Persistent domain foundation

Goals:

- introduce the first production persistence layer,
- define durable domain entities for:
  - users,
  - course memberships,
  - assignments,
  - submissions,
  - reviews,
  - exam batches,
  - flags,
  - audit events,
  - analytics snapshots.
- move file references into explicit metadata records rather than direct route-handler path assumptions.

Target direction:

- Firestore plus Storage.

### Phase 3: Course and authorization model

Goals:

- implement course-scoped lecturer and student access,
- add `Course Membership`,
- define lecturer/admin versus student capabilities,
- introduce secure course-level navigation and data filtering.

### Phase 4: Assignment module

Goals:

- add `Week`,
- add `Assignment`,
- add `Submission` lifecycle and deadline rules,
- queue grading only after deadline,
- support lecturer review and publish flow for assignments.

### Phase 5: Exam batch module

Goals:

- add `Exam Batch`,
- support bulk ingestion,
- support class-level analytics,
- support export,
- support lecturer review before final export or publication.

### Phase 6: Audit, analytics, notifications, and hardening

Goals:

- materialize analytics snapshots,
- add first-class flags,
- add immutable audit events,
- add notification flows,
- harden operational observability and failure recovery.

## 16. Open Questions / Decisions

1. Identity convergence:
   - Near-term auth is Auth.js in `apps/web`.
   - Target platform direction is Firebase Auth.
   - A future decision is required on whether Auth.js remains the web session layer, is bridged to Firebase identity, or is replaced by Firebase Auth as the primary identity layer.

2. Lecturer authority model:
   - Does each course allow one lecturer, multiple lecturers, lecturer plus assistants, or lecturer plus graders?
   - This affects `Course Membership`, approval flows, and analytics visibility.

3. Submission policy:
   - At deadline, should only the latest active submission be graded, while older ones remain archived?
   - This is the recommended direction, but it should be confirmed explicitly.

4. Model-solution versus rubric structure:
   - Should model solutions and rubrics be separate first-class versioned artifacts, or can one derive the other in some modules?

5. Review publishing semantics:
   - Is publication per submission, per assignment, per exam batch, or both?
   - The answer affects student visibility and notification triggers.

6. Notification channels:
   - Email, in-app, push, institution LMS integration, or a mix?

7. Analytics ownership:
   - Which analytics are computed on demand versus materialized as `Analytics Snapshot` records?

8. Migration strategy:
   - Should the file-backed stores be wrapped behind repository interfaces before data migration, or migrated directly route-by-route?
   - The recommended direction is to introduce clearer repository/service boundaries first.
