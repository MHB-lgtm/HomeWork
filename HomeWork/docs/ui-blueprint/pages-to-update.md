# Pages To Update (Apply Home Blueprint)
Scope: visual alignment only.  
Do **not** change data flow, API contracts, worker behavior, or event semantics.

## Route Inventory (UI pages)
- `/` (Home, source blueprint)
- `/exams`
- `/rubrics`
- `/reviews`
- `/reviews/[jobId]`
- `/courses`
- `/courses/[courseId]`

## Route-by-Route Mapping

| Route | Apply Home Patterns | Visual Changes Planned | Must NOT Change |
|---|---|---|---|
| `/exams` | `HeroHeader`, `CenteredFormPanel`, `SubSectionBlock`, `DropzoneLikeInput`, `TechnicalDetailsDisclosure`, `PrimaryActionButton` | Normalize container rhythm to Home (`max-w-3xl`/`max-w-6xl` split where needed), unify upload block look, standardize table/card spacing and muted helper text | `createExam`, `listExams`, index status loading logic, warning/success/error behavior |
| `/rubrics` | `HeroHeader` (or `PageHeader` tuned to same scale), `SubSectionBlock`, `TechnicalDetailsDisclosure`, `PrimaryActionButton` | Align left/right panel styling with Home surfaces, unify input/select/textarea styling, improve section spacing and headings consistency | rubric load/save behavior, criteria validation, question/exam selection logic |
| `/reviews` | `HeroHeader`, `StatusTimelineCard` (adapted), `TechnicalDetailsDisclosure`, `PrimaryActionButton` | Standardize list cards/titles/badges to Home palette and spacing; keep review cards cleaner with same corner radius/shadow language | list/filter/search, rename flow, status mapping, routing to `/reviews/[jobId]` |
| `/reviews/[jobId]` | `TechnicalDetailsDisclosure`, `StatusTimelineCard` (panel styling only), `SubSectionBlock` | Keep split-view architecture, only harmonize header/panel surface tokens and spacing scale with Home | PDF/viewer behavior, annotation selection, scroll sync lock logic, pointers logic |
| `/courses` | Reuse current good structure + align typography scale to Home where useful | Minimal changes: keep existing comfortable spacing; only token-level alignment (buttons/alerts/cards) if needed | create/list courses flow and table behavior |
| `/courses/[courseId]` | `SubSectionBlock`, `TechnicalDetailsDisclosure`, `PrimaryActionButton` | Unify card shells and heading hierarchy with Home style; preserve two-column content architecture | lecture upload/listing, RAG rebuild/query state, manifest logic |

## High-ROI Order
1. `/exams`  
Why first: highest visibility and most user-facing workflow overlap with Home.

2. `/rubrics`  
Why second: currently dense form UI; benefits most from consistent section/spacing system.

3. `/reviews`  
Why third: list clarity + status readability impact daily usage.

4. `/courses` + `/courses/[courseId]`  
Why fourth: already visually acceptable; mainly token harmonization.

5. `/reviews/[jobId]`  
Why last: complex interaction surface; style-only pass should be extra conservative.

## Guardrails For All UI PRs
- Keep all fetch calls, handlers, and state transitions intact.
- Keep all route URLs and query semantics intact.
- Keep all IDs/technical data accessible (can be visually tucked into `<details>`).
- Validate with TypeScript after every PR.
