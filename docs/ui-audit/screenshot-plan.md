# Screenshot Plan (Before Redesign)

Automation note: Playwright is not installed in this repo, so no screenshot script was added in this audit pass.

Use these two viewports for every capture:
- Desktop: `1440x900`
- Mobile: `390x844`

## Capture Matrix

### 1) `/` (Home / Create Grading Job)
- States:
  - Initial load (empty form)
  - Job submitted while pending/running
  - Job completed (result summary visible)
- Focus areas:
  - Main dashboard card hierarchy
  - Form density and control grouping
  - Status section and call-to-action buttons

### 2) `/exams`
- States:
  - Empty/default
  - After exam create success/warning banner
  - Existing exams table populated
- Focus areas:
  - Legacy inline form styling
  - Message/banner colors
  - Table header/row spacing consistency

### 3) `/rubrics`
- States:
  - Empty/new rubric state
  - Loaded rubric with multiple criteria rows
  - Validation error state (invalid criterion fields)
- Focus areas:
  - Inline form grid and control alignment
  - Criteria row readability and action buttons
  - Error/success feedback styling

### 4) `/reviews`
- States:
  - Loading
  - Empty list
  - Populated list (multiple cards)
  - Name editing state (inline add/edit)
- Focus areas:
  - Card density and scanability
  - Metadata badges and hierarchy
  - Search + quick actions

### 5) `/reviews/[jobId]`
- States:
  - GENERAL review with findings and annotation overlays
  - RUBRIC review (if available)
  - PDF loading/error state (if reproducible)
- Focus areas:
  - Main split layout (viewer pane + findings/sidebar)
  - Annotation overlay clarity
  - Header actions and sticky/scroll behavior

### 6) `/courses`
- States:
  - Empty courses
  - Populated courses table
  - Error alert state (if reproducible)
- Focus areas:
  - Page header + badges
  - Create card vs table layout balance
  - Table readability and action alignment

### 7) `/courses/[courseId]`
- States:
  - Initial loading
  - No index built / index error
  - Index built (manifest shown)
  - RAG test panel with returned results
- Focus areas:
  - Multi-panel page rhythm
  - Card spacing consistency
  - Status feedback consistency across panels

## Capture Guidance
- Keep browser zoom at 100%.
- Capture full viewport, not cropped components.
- Use same seed data before/after redesign for reliable comparison.
- For dynamic timestamps/statuses, prioritize layout and visual hierarchy over exact text values.
