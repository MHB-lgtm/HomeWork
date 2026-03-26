# AGENTS.md

## Repo rules

- Keep diffs minimal.
- Do not make unrelated refactors.
- For any multi-step change, plan first.
- The active file under `plans/` is the source of truth for milestone work.
- If implementation scope must change, update the relevant plan file first.
- Run the relevant validations after each milestone.
- Fix failures introduced by the change before continuing.
- Report files changed, validations run, and remaining risks in every milestone closeout.
- Keep auth and session code separate from domain and grading logic.
- Enforce security on the server side for sensitive routes and APIs; UI-only gating is not sufficient.
- Preserve backward compatibility unless a change is explicitly approved.
- Update docs when setup, operational steps, or user-visible behavior changes.

## Repo-specific guidance

- `apps/web` owns UI, login/logout flow, route protection, session handling, and API request boundaries.
- `apps/worker` must stay unchanged unless a milestone explicitly includes worker changes.
- File-backed domain stores in `packages/local-job-store` and `packages/local-course-store` are not the place for auth logic in Milestone 1.
- Do not introduce a database, ORM, RBAC, ownership fields, or multi-tenancy unless the milestone explicitly requires them.
- Prefer centralized auth boundaries over scattered page-by-page checks.
- For Milestone 1, keep auth-related changes scoped primarily to `apps/web`.
