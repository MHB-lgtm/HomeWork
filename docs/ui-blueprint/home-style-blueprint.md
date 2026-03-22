# Home Style Blueprint
Last extracted: 2026-02-25  
Source of truth: `apps/web/src/app/page.tsx`

## 1) Home Implementation + Dependencies

### Main files
- Home page: `apps/web/src/app/page.tsx`
- Root layout/fonts: `apps/web/src/app/layout.tsx`
- Global tokens/base styles: `apps/web/src/app/globals.css`
- App shell behavior: `apps/web/src/components/layout/AppShell.tsx`

### Important dependency note
- `/` is an immersive route in `AppShell` (`isImmersiveRoutePath`), so Home renders its own top nav and does **not** use the global shell header.

### Components used by Home (`page.tsx`)
- `Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Badge`, `Alert`, `AlertTitle`, `AlertDescription`, `Input`, `Textarea`, `Table*`
- `RubricCriterionRow`, `Link`
- Utility: `cn` (`../lib/utils`)
- Font override on page: `Inter` (`next/font/google`)

### Layout tree (current)
1. Full-screen gradient background `<main>`
2. Fixed floating pill top nav (logo + route links)
3. Centered content region (`flex-1`) with:
- Hero text block (H1 + subtitle + worker warning alert)
- Main form card (create/check flow)
- Post-submit status + results cards

## 2) Visual Rules (Exact Classes)

## A) Page Container + Positioning

### Full page background wrapper
```tsx
<main className={`${inter.className} min-h-screen text-slate-900 bg-[radial-gradient(...),linear-gradient(...)]`} />
```
- Centering method: `flex` + `mx-auto`
- Main vertical shell:
```tsx
<div className="mx-auto flex min-h-screen w-full flex-col px-4 pb-8 pt-28 md:px-6 md:pb-10 md:pt-32" />
```

### Vertical placement of hero + form
```tsx
<div className="flex flex-1 items-center justify-center py-10 md:py-14">
  <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
```
- Hero sits centered in viewport via `flex-1 items-center justify-center`.
- Extra breathing between hero and form:
```tsx
<div className="mx-auto mt-16 flex w-full flex-col items-center gap-6 md:mt-20" />
```

## B) Typography Scale

### H1
```tsx
className="font-heading text-4xl font-bold tracking-tight text-slate-900 md:text-5xl"
```

### Subtitle
```tsx
className="mx-auto max-w-2xl text-base text-slate-700 md:text-xl"
```

### Small section labels / helper text
- Form section title:
```tsx
className="text-sm font-medium text-slate-900"
```
- Tiny technical/helper:
```tsx
className="text-xs text-slate-600"
className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
```

## C) Surfaces (Cards / Panels / Form Blocks)

### Main form panel
```tsx
className="mx-auto w-full max-w-3xl rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/40"
```

### Internal form sections
```tsx
className="rounded-2xl border border-slate-200/80 bg-white/70 p-6"
className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 space-y-4"
```

### Technical disclosure style
```tsx
className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600"
```

### Results/status cards
```tsx
className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm"
```

## D) Actions and Buttons

### Primary CTA (home form submit)
```tsx
className="h-12 w-full rounded-xl bg-slate-900 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
```

### Secondary action pattern
- Uses `Button` variants (`outline`, `secondary`, `ghost`) with full-width on major actions:
```tsx
className="w-full"
```

### Action row behavior
- Uses wrapping/flex on complex rows:
```tsx
className="flex items-center justify-between gap-4"
className="flex gap-2"
className="flex flex-wrap gap-2"
```

## E) Background / Hero Styling

### Page gradient stack (applied on `<main>`)
```tsx
bg-[radial-gradient(1200px_520px_at_50%_-8%,rgba(255,255,255,0.98),rgba(255,255,255,0)_62%),radial-gradient(900px_520px_at_12%_38%,rgba(59,130,246,0.44),rgba(59,130,246,0)_70%),radial-gradient(900px_520px_at_88%_38%,rgba(56,189,248,0.38),rgba(56,189,248,0)_70%),radial-gradient(1000px_540px_at_50%_100%,rgba(244,114,182,0.42),rgba(244,114,182,0)_76%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_48%,#ffe8f4_100%)]
```

### Glass/soft surface effects
- `bg-white/90`, `bg-white/95`
- `backdrop-blur-md`, `backdrop-blur-sm`
- Soft shadows with custom rgba values

## F) Header / Nav (Top Bar)

### Home top bar controller
- Controlled directly by `apps/web/src/app/page.tsx` (not `AppShell` for `/`).

### Floating nav classes (current home)
```tsx
<header className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 md:px-6">
  <div className="flex w-full max-w-[1180px] items-center justify-between rounded-full bg-white px-8 py-3 md:px-10 shadow-md">
```

### Non-home global nav (for other pages)
- Controlled by `apps/web/src/components/layout/AppShell.tsx`:
```tsx
className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur ..."
```

## 3) Home Blueprint Summary (Copyable)
- Constrain content: `max-w-3xl` for hero/form core.
- Keep vertical centering: `flex-1 items-center justify-center`.
- Keep big rounded panel: `rounded-[2rem] border-slate-200 bg-white shadow-xl`.
- Use dark slate CTA (`bg-slate-900`).
- Preserve soft gradient background and floating pill nav.
