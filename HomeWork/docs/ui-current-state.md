# UI Current State Audit (Next.js App Router)

Date: 2026-02-22
Scope: discovery-only snapshot of current UI state in `apps/web`.

## 1) Stack Summary

### Framework and runtime
- Next.js App Router (`next@^14`) + React 18.
- Web app package: `apps/web/package.json`.

### Styling system
- Tailwind CSS is in use (`tailwindcss@^4.1.18`, `@tailwindcss/postcss`, `autoprefixer`).
- Tailwind entrypoint: `apps/web/src/app/globals.css` (`@import "tailwindcss";`).
- Tailwind config: `apps/web/tailwind.config.ts`.
- PostCSS config: `apps/web/postcss.config.js`.

### Component system
- `components/ui/*` contains custom primitive components (`Button`, `Card`, `Badge`, `Alert`, `Input`, `Textarea`, `Table`).
- Pattern is shadcn-like (folder/API style), but implemented locally (no `@radix-ui/*` dependency detected).
- Utility class merging uses `clsx` + `tailwind-merge` via `apps/web/src/lib/utils.ts` (`cn()` helper).

### Additional UI libs
- `react-pdf` is used for review PDF rendering (`PDFViewer`).
- No dependency usage detected for:
- `@radix-ui/*`
- `lucide-react`
- `next-themes`
- `framer-motion`

### Fonts and typography
- Fonts configured in `apps/web/src/app/layout.tsx` using `next/font/google`:
- `Manrope` (body)
- `Space Grotesk` (headings)
- CSS variables from layout: `--font-body`, `--font-heading`.
- Global typography and tokens in `apps/web/src/app/globals.css`.

### Dark mode readiness
- No theme provider or dark mode switch.
- No `.dark` class strategy observed.
- Theme variables exist in `:root`, but only light palette currently wired.

## 2) Route Map and Page Composition

### 2.1 UI Routes (App Router pages)

| Route | Page file | Major components used |
|---|---|---|
| `/` | `apps/web/src/app/page.tsx` | `RubricCriterionRow`, `ui/{button,card,badge,alert,input,textarea,table}` |
| `/exams` | `apps/web/src/app/exams/page.tsx` | Native HTML form/table (no `components/ui` usage) |
| `/rubrics` | `apps/web/src/app/rubrics/page.tsx` | Native HTML form/layout (no `components/ui` usage) |
| `/reviews` | `apps/web/src/app/reviews/page.tsx` | `ui/{card,badge,button,alert,input}` |
| `/reviews/[jobId]` | `apps/web/src/app/reviews/[jobId]/page.tsx` | `PDFViewer`, `StudyPointersPanel`, `ui/{card,badge,alert}` |
| `/courses` | `apps/web/src/app/courses/page.tsx` | `CreateCourseCard`, `CoursesTable`, `ui/{alert,badge,button}` |
| `/courses/[courseId]` | `apps/web/src/app/courses/[courseId]/page.tsx` | `LectureUploadForm`, `LecturesTable`, `RagIndexPanel`, `RagTestPanel`, `ui/{alert,badge,button,card}` |

### 2.2 Shared layouts/providers
- Global root layout only: `apps/web/src/app/layout.tsx`.
- No nested route `layout.tsx` files detected.
- No UI provider layer detected (theme/toast/global state providers).
- No global nav shell component; each page renders its own top/header controls.

### 2.3 API route handlers under App Router (for completeness)
- `/api/health` -> `apps/web/src/app/api/health/route.ts`
- `/api/exams` -> `apps/web/src/app/api/exams/route.ts`
- `/api/exams/[examId]` -> `apps/web/src/app/api/exams/[examId]/route.ts`
- `/api/exams/[examId]/index` -> `apps/web/src/app/api/exams/[examId]/index/route.ts`
- `/api/jobs` -> `apps/web/src/app/api/jobs/route.ts`
- `/api/jobs/[id]` -> `apps/web/src/app/api/jobs/[id]/route.ts`
- `/api/jobs/[id]/submission` -> `apps/web/src/app/api/jobs/[id]/submission/route.ts`
- `/api/jobs/[id]/submission-raw` -> `apps/web/src/app/api/jobs/[id]/submission-raw/route.ts`
- `/api/rubrics` -> `apps/web/src/app/api/rubrics/route.ts`
- `/api/rubrics/[examId]/[questionId]` -> `apps/web/src/app/api/rubrics/[examId]/[questionId]/route.ts`
- `/api/reviews` -> `apps/web/src/app/api/reviews/route.ts`
- `/api/reviews/[jobId]` -> `apps/web/src/app/api/reviews/[jobId]/route.ts`
- `/api/courses` -> `apps/web/src/app/api/courses/route.ts`
- `/api/courses/[courseId]` -> `apps/web/src/app/api/courses/[courseId]/route.ts`
- `/api/courses/[courseId]/lectures` -> `apps/web/src/app/api/courses/[courseId]/lectures/route.ts`
- `/api/courses/[courseId]/rag/manifest` -> `apps/web/src/app/api/courses/[courseId]/rag/manifest/route.ts`
- `/api/courses/[courseId]/rag/query` -> `apps/web/src/app/api/courses/[courseId]/rag/query/route.ts`
- `/api/courses/[courseId]/rag/rebuild` -> `apps/web/src/app/api/courses/[courseId]/rag/rebuild/route.ts`
- `/api/courses/[courseId]/rag/suggest` -> `apps/web/src/app/api/courses/[courseId]/rag/suggest/route.ts`

## 3) Layout and Theming Analysis

### Global styling and tokens
- Global variables and visual tokens in `globals.css` (`--bg-*`, `--text-*`, `--accent-*`, shadows).
- Shared background utility class (`.review-page-bg`) used by multiple pages.
- Custom scrollbar styling classes for review/PDF areas.

### Layout patterns in use
- Home (`/`): large single-column dashboard, nested cards and sections.
- Reviews detail (`/reviews/[jobId]`): full-height split layout (`lg:grid-cols-3`), left content + right sidebar, independent scrolling, sticky-like shell behavior.
- Courses pages: card-based layout with responsive two-column sections.
- Exams and Rubrics pages: older inline-style layout style (manual CSS-in-JS `style={...}`), visually distinct from newer Tailwind card pages.

### Theming consistency
- Mixed implementation style across pages:
- Modern Tailwind + ui primitives (`/`, `/reviews*`, `/courses*`)
- Legacy inline styles (`/exams`, `/rubrics`)
- This creates visible inconsistency in spacing, typography, and control appearance.

## 4) Reusable Component Inventory

### 4.1 UI primitives (`components/ui`)
- `apps/web/src/components/ui/button.tsx`
- `apps/web/src/components/ui/card.tsx`
- `apps/web/src/components/ui/badge.tsx`
- `apps/web/src/components/ui/alert.tsx`
- `apps/web/src/components/ui/input.tsx`
- `apps/web/src/components/ui/textarea.tsx`
- `apps/web/src/components/ui/table.tsx`

### 4.2 Feature components
- Courses:
- `apps/web/src/components/courses/CreateCourseCard.tsx`
- `apps/web/src/components/courses/CoursesTable.tsx`
- `apps/web/src/components/courses/LectureUploadForm.tsx`
- `apps/web/src/components/courses/LecturesTable.tsx`
- `apps/web/src/components/courses/RagIndexPanel.tsx`
- `apps/web/src/components/courses/RagTestPanel.tsx`
- Reviews:
- `apps/web/src/components/review/pdf/PDFViewer.tsx`
- `apps/web/src/components/review/StudyPointersPanel.tsx`

### 4.3 Page-scoped component
- `apps/web/src/components/RubricCriterionRow.tsx` (used by home rubric result table flow).

## 5) UI Quality Snapshot (Observations)

### 5.1 Layout and visual consistency
- Strong inconsistency between pages using Tailwind primitives and pages using raw inline styles.
- Home and review pages are visually richer than Exams/Rubrics pages.
- Different header patterns and navigation treatment per page (no shared top shell).

### 5.2 Forms and upload UX
- Home form is comprehensive but very dense (many controls in one page section).
- Exams and Rubrics forms are functional but visually and interactively older (plain inputs, manual color system).
- Course forms have clearer validation and feedback flow.

### 5.3 Tables/lists patterns
- Good reusable table primitives for Courses/Home results.
- Reviews list uses card-grid instead of table (good scannability).
- Rubrics and Exams still use plain HTML table/form style rather than shared primitives.

### 5.4 State handling patterns
- Loading, error, and empty states are present in most key pages.
- State messaging style varies significantly by page family:
- `Alert` components on modern pages
- manual colored boxes on legacy pages

### 5.5 Accessibility basics
Positives:
- Most form controls have explicit labels.
- Focus ring styles exist in core primitives (`Button`, `Input`, `Textarea`).
- `Alert` includes `role="alert"`.

Gaps:
- Several interactive `div` elements in review/PDF interactions are mouse-centric (not fully keyboard semantic).
- No shared landmark/nav shell or skip-link pattern.
- Mixed heading and structure consistency between old/new pages.
- `Badge` implemented as `div` (fine visually, but semantic meaning is purely visual).

## 6) Pain Points / Inconsistencies

1. Mixed design systems in production UI
- Tailwind primitive system and old inline-styled screens coexist.

2. Very large page components (high coupling)
- `apps/web/src/app/page.tsx` (~762 lines)
- `apps/web/src/app/reviews/[jobId]/page.tsx` (~838 lines)
- `apps/web/src/components/review/pdf/PDFViewer.tsx` (~431 lines)

3. High interaction complexity in review experience
- Scroll sync, page tracking, annotation selection, and rendering are tightly coupled.

4. No shared app shell
- Header/nav pattern repeated inconsistently per page.

5. Theming is light-only and implicit
- No formal dark mode/theming provider strategy.

## 7) Quick-Win Recommendations (No code changes in this phase)

### P0 (highest redesign value)
1. Unify visual language across all top-level pages
- Bring `/exams` and `/rubrics` into same component system as `/`, `/reviews`, `/courses`.

2. Define shared app shell contract
- Standard header, breadcrumb area, and action region.

3. Establish design tokens baseline for spacing/typography hierarchy
- Explicit sizes for page title, section title, body, helper text.

### P1
4. Break down large page responsibilities for redesign planning
- Home: split form, status, and results modules.
- Review detail: split toolbar, canvas area, sidebar list, metadata panel.

5. Standardize state components
- Unified loading, empty, warning, error blocks across pages.

### P2
6. Accessibility pass plan for redesign
- Keyboard operability targets for annotation interactions.
- Landmark and heading consistency checklist.

7. Mobile-first behavior audit baseline
- Verify each page at 390px before redesign, especially review/PDF flows.

## 8) Screenshot Checklist (Human Capture Plan)

Capture every page at:
- Desktop: `1440x900`
- Mobile: `390x844`

Screens to capture:
1. `/`
- Initial form state
- After job creation (status panel visible)

2. `/exams`
- Default page
- Post-create message state (success/warning)

3. `/rubrics`
- Empty/new rubric state
- Loaded rubric state (criteria list visible)

4. `/reviews`
- Empty list state
- Populated list state

5. `/reviews/[jobId]`
- RUBRIC result view (if available)
- GENERAL result view with findings + PDF/image annotation overlays

6. `/courses`
- Empty list state
- Populated list state

7. `/courses/[courseId]`
- Before index built (manifest missing)
- After index built (manifest stats visible)
- RAG test panel with results
