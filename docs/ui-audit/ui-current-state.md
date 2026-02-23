# UI Current State (Discovery Audit)

Date: 2026-02-23  
Scope: `apps/web` Next.js App Router UI only. Discovery for redesign planning (no runtime changes).

## 1) UI Stack Summary

### Framework
- Next.js App Router (`next@^14`) + React 18 (`apps/web/package.json`).
- `reactStrictMode: true` in `apps/web/next.config.js`.

### Styling System
- Tailwind CSS v4 is active:
  - `tailwindcss`, `@tailwindcss/postcss`, `autoprefixer` in `apps/web/package.json`.
  - `@import "tailwindcss";` in `apps/web/src/app/globals.css`.
  - Tailwind content config in `apps/web/tailwind.config.ts`.
  - PostCSS pipeline in `apps/web/postcss.config.js`.
- Utility composition helper: `cn()` (`clsx` + `tailwind-merge`) in `apps/web/src/lib/utils.ts`.

### Component Pattern
- Local primitive library under `apps/web/src/components/ui/*` (shadcn-like folder pattern, custom implementation).
- No Radix dependency detected.

### Additional UI Libraries
- `react-pdf` used for review PDF rendering: `apps/web/src/components/review/pdf/PDFViewer.tsx`.
- No detected usage/dependency for:
  - `@radix-ui/*`
  - `lucide-react`
  - `next-themes`
  - `framer-motion`

## 2) Theming and Dark Mode

- Global CSS variables defined in `apps/web/src/app/globals.css` (`--bg-*`, `--text-*`, `--accent-*`, shadows).
- Fonts are injected via `next/font/google` in `apps/web/src/app/layout.tsx`:
  - `Manrope` (`--font-body`)
  - `Space Grotesk` (`--font-heading`)
- No theme provider (`next-themes`) and no `.dark` class strategy detected.
- Current setup is effectively light-theme only, with tokenized variables in `:root`.

## 3) Typography and Spacing Notes

### Typography
- Global heading family and body family are centralized in `globals.css` + root layout font variables.
- Strong heading style in newer pages (`text-3xl/4xl`, tracking-tight, uppercase meta labels).
- Legacy pages (`/exams`, `/rubrics`) use browser/system defaults + inline styles, causing hierarchy mismatch.

### Spacing
- Newer pages use Tailwind spacing scales consistently (`px-4 py-8`, `space-y-*`, responsive containers).
- `/exams` and `/rubrics` use ad-hoc inline spacing/pixel values, visually detached from the rest.

## 4) Route Map (UI Pages)

| Route | Page file | Layouts applied | Key components used (top-level) |
|---|---|---|---|
| `/` | `apps/web/src/app/page.tsx` | `apps/web/src/app/layout.tsx` | `RubricCriterionRow`, `ui/{button,card,badge,alert,input,textarea,table}` |
| `/exams` | `apps/web/src/app/exams/page.tsx` | `apps/web/src/app/layout.tsx` | none (native form/table + inline styles) |
| `/rubrics` | `apps/web/src/app/rubrics/page.tsx` | `apps/web/src/app/layout.tsx` | none (native form/layout + inline styles) |
| `/reviews` | `apps/web/src/app/reviews/page.tsx` | `apps/web/src/app/layout.tsx` | `ui/{card,badge,button,alert,input}` |
| `/reviews/[jobId]` | `apps/web/src/app/reviews/[jobId]/page.tsx` | `apps/web/src/app/layout.tsx` | `review/pdf/PDFViewer`, `review/StudyPointersPanel`, `ui/{card,badge,alert}` |
| `/courses` | `apps/web/src/app/courses/page.tsx` | `apps/web/src/app/layout.tsx` | `courses/{CreateCourseCard,CoursesTable}`, `ui/{alert,badge,button}` |
| `/courses/[courseId]` | `apps/web/src/app/courses/[courseId]/page.tsx` | `apps/web/src/app/layout.tsx` | `courses/{LectureUploadForm,LecturesTable,RagIndexPanel,RagTestPanel}`, `ui/{alert,badge,button,card}` |

Notes:
- Only one layout exists: `apps/web/src/app/layout.tsx`.
- No nested `layout.tsx` files detected.

### 4.1 Non-UI Routes Under `apps/web/src/app` (API handlers)

For completeness, the following App Router API paths also exist under `apps/web/src/app/api`:
- `/api/health`
- `/api/exams`
- `/api/exams/[examId]`
- `/api/exams/[examId]/index`
- `/api/jobs`
- `/api/jobs/[id]`
- `/api/jobs/[id]/submission`
- `/api/jobs/[id]/submission-raw`
- `/api/rubrics`
- `/api/rubrics/[examId]/[questionId]`
- `/api/reviews`
- `/api/reviews/[jobId]`
- `/api/courses`
- `/api/courses/[courseId]`
- `/api/courses/[courseId]/lectures`
- `/api/courses/[courseId]/rag/manifest`
- `/api/courses/[courseId]/rag/query`
- `/api/courses/[courseId]/rag/rebuild`
- `/api/courses/[courseId]/rag/suggest`

## 5) Shared Layout/Providers/Nav Patterns

- Root layout provides fonts + global CSS only.
- No global providers found for theme, toasts, or app-wide UI state.
- No shared app shell component (sidebar/topbar). Each page renders its own local header/navigation.

## 6) Reusable Component Inventory Summary

### UI Primitives (`apps/web/src/components/ui`)
- `alert.tsx`, `badge.tsx`, `button.tsx`, `card.tsx`, `input.tsx`, `table.tsx`, `textarea.tsx`.

### Feature Components
- Courses:
  - `CreateCourseCard.tsx`
  - `CoursesTable.tsx`
  - `LectureUploadForm.tsx`
  - `LecturesTable.tsx`
  - `RagIndexPanel.tsx`
  - `RagTestPanel.tsx`
- Review:
  - `review/pdf/PDFViewer.tsx`
  - `review/StudyPointersPanel.tsx`

### Page-only
- `apps/web/src/components/RubricCriterionRow.tsx`.

## 7) Visual Consistency Snapshot (Observations)

### Layout and Visual Cohesion
1. **Mixed UI systems (highest priority)**: `/exams` and `/rubrics` are inline-styled legacy screens, while `/`, `/reviews*`, `/courses*` use Tailwind + primitives.
2. **No shared app shell**: navigation and action areas vary per page.
3. **Page complexity concentration**: very large files (`/` ~762 lines, `/reviews/[jobId]` ~838, `PDFViewer` ~431) make visual consistency harder to enforce.

### Forms and Inputs
- New pages: consistent rounded inputs/buttons and alert states.
- Legacy pages: custom inline form controls, divergent spacing/colors/focus behavior.

### Tables/Lists
- Good reusable table primitives exist (`components/ui/table.tsx`).
- Course tables leverage shared primitives well.
- Reviews use cards (not table), which is fine but visually different from other data-heavy screens.
- `/exams` uses raw `<table>` with inline styling.

### States (Empty/Loading/Error)
- Present on most pages.
- Not standardized visually:
  - Modern pages use `Alert` and Tailwind tokens.
  - Legacy pages use manual colored boxes/inline styles.

### Accessibility Basics
- Positives:
  - Inputs/buttons include focus-visible rings in primitives.
  - `Alert` has `role="alert"`.
  - Labels exist for most form fields.
- Gaps:
  - Interactive overlay boxes in PDF viewer are clickable `div`s (mouse-first semantics).
  - No global skip-link/landmark strategy.
  - Heading/navigation structure differs between page families.

## 8) Top Pain Points (Prioritized)

### P0
1. Inconsistent design language between legacy pages (`/exams`, `/rubrics`) and modern pages.
2. Missing shared app shell (navigation and page scaffolding repeated/inconsistent).

### P1
3. Large coupled page components slow redesign iteration and increase regression risk.
4. Inconsistent state component style (loading/empty/error patterns differ).

### P2
5. Accessibility semantics in complex review interactions need a dedicated pass.
6. Light-only theming limits design flexibility for premium dashboard polish.

## 9) Redesign Constraints (Must Not Change)

- Keep route structure and URL contracts stable.
- Do not change API contracts, worker behavior, schemas, job semantics, or storage layout.
- Keep existing business workflows intact (exam upload, job creation, review browsing).
- Keep existing data rendering semantics in review pages (status, annotations, PDF/image handling).
- Redesign should be presentational/component-architecture focused.

## 10) High ROI Redesign Plan (No Code Yet)

### Iteration 1: Foundation + Shell
- Define design tokens (color/spacing/radius/shadow/type scale) in one source of truth.
- Introduce shared App Shell (`Sidebar + Topbar + Content container`).
- Standardize page primitives: `PageHeader`, `SectionCard`, `EmptyState`, `ErrorState`, `Skeleton`.

### Iteration 2: Page Unification
- Migrate `/exams` and `/rubrics` from inline styles to shared primitives.
- Normalize forms, table/list patterns, and action bars across all top-level pages.
- Align status chips, badges, and alert patterns.

### Iteration 3: Advanced UX Polish
- Improve review detail ergonomics (clearer hierarchy, sticky controls, panel rhythm).
- Accessibility hardening (keyboard targets, semantics for annotation interactions).
- Add subtle, consistent motion and micro-interactions (without changing business behavior).

## 11) Premium Redesign Gaps (Current Missing Pieces)

- No unified shell/navigation system.
- No formalized design tokens beyond basic CSS vars.
- No component-level documentation/story baseline.
- Legacy screens still bypass shared primitives.
- No dark mode/theming system for premium multi-theme readiness.
