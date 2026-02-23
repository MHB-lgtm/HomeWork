# Design Target Brief (Upcoming Redesign)

Date: 2026-02-23  
Scope: Visual/UI redesign direction only. No business logic or API contract changes.

## 1) Look & Feel Goals (Linear / Vercel-inspired)

- Clean, high-contrast information hierarchy with restrained color usage.
- Minimal but premium surfaces: soft borders, subtle depth, controlled blur.
- Dense-but-readable dashboard ergonomics for operations workflows.
- Fast scanability: compact metadata rows, clear status signaling, predictable actions.
- Motion should be sparse and purposeful (state transitions, panel reveals, not decorative noise).

## 2) Proposed App Shell

### Structure
- Left sidebar (primary navigation): Home, Exams, Rubrics, Reviews, Courses.
- Topbar (contextual): page title, breadcrumbs, global actions/search.
- Main content area with standardized max-width + section rhythm.

### Behavior
- Sticky sidebar on desktop.
- Collapsible drawer navigation on mobile.
- Shared page chrome so each route focuses on content, not repeated scaffolding.

## 3) Proposed Core Component Set

- `PageHeader`
  - title, subtitle, optional badges, right-side actions
- `StatCard`
  - compact KPI summary with optional trend/context
- `DataTable`
  - consistent header/row/action pattern with loading + empty + error slots
- `EmptyState`
  - icon/title/description/primary+secondary CTA
- `Skeleton`
  - reusable loading placeholders for cards/table rows/forms
- `StatusBadge`
  - standardized statuses (`PENDING`, `RUNNING`, `DONE`, `FAILED`, warning/info variants)
- `FormSection`
  - labeled grouped fields with helper/error text convention
- `Panel`
  - reusable content container with consistent padding/radius/shadow

## 4) Recommended Visual Tokens (No Implementation Yet)

### Color Tokens
- Neutrals:
  - `bg.canvas`, `bg.surface`, `bg.elevated`
  - `text.primary`, `text.secondary`, `text.tertiary`
  - `border.subtle`, `border.default`
- Brand:
  - `brand.500`, `brand.600`, `brand.50`
- Semantic:
  - `success`, `warning`, `danger`, `info` (bg/text/border triplets)

### Spacing Scale
- Base rhythm: 4px scale (`4, 8, 12, 16, 20, 24, 32, 40, 48`).
- Section spacing: standardize vertical spacing across pages (`24/32`).

### Radius
- `sm: 8`, `md: 12`, `lg: 16`, `xl: 20`, `pill: 9999`.

### Shadows
- `shadow.sm`: low elevation cards
- `shadow.md`: interactive cards
- `shadow.lg`: modal/popover emphasis
- Prefer low blur + low opacity for enterprise cleanliness

### Typography
- Preserve current font pairing (`Manrope` body + `Space Grotesk` headings).
- Define explicit type roles:
  - Display, PageTitle, SectionTitle, Body, Caption, Label.

## 5) Implementation Guardrails for Redesign PR

- Preserve all existing route paths and URL behavior.
- Preserve API payload contracts and worker semantics.
- Keep state semantics unchanged (loading/error/success conditions), only improve presentation.
- Roll out page-by-page with visual parity checks against `docs/ui-audit/screenshot-plan.md`.
