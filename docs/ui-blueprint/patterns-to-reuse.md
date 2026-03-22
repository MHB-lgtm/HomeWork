# Patterns To Reuse
Source extracted from: `apps/web/src/app/page.tsx`  
Goal: reuse Home visual language without changing business logic.

## 1) `FloatingPillTopNav`
Use on:
- `/` (already)
- Optional for landing-like top sections in `/exams` or `/rubrics` if immersive mode is desired

JSX skeleton:
```tsx
<header className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 md:px-6">
  <div className="flex w-full max-w-[1180px] items-center justify-between rounded-full bg-white px-8 py-3 md:px-10 shadow-md">
    {/* logo */}
    {/* nav links */}
  </div>
</header>
```
Key classes:
- `fixed top-4 inset-x-0 z-50`
- `max-w-[1180px] rounded-full bg-white shadow-md`
- `items-center justify-between px-8 py-3`

## 2) `HeroHeader`
Use on:
- `/exams`, `/rubrics`, `/reviews`, `/courses` page tops

JSX skeleton:
```tsx
<section className="flex w-full flex-col items-center gap-4 text-center">
  <h1 className="font-heading text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">...</h1>
  <p className="mx-auto max-w-2xl text-base text-slate-700 md:text-xl">...</p>
</section>
```
Key classes:
- `items-center text-center`
- `text-4xl md:text-5xl` (title)
- `max-w-2xl text-base md:text-xl` (subtitle)

## 3) `CenteredFormPanel`
Use on:
- Primary create/edit workflows (`/exams` upload, rubric setup blocks, review filters)

JSX skeleton:
```tsx
<div className="flex flex-1 items-center justify-center py-10 md:py-14">
  <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
    <Card className="mx-auto w-full max-w-3xl rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/40">
      <CardContent className="space-y-8 pt-6">{/* form */}</CardContent>
    </Card>
  </div>
</div>
```
Key classes:
- `max-w-3xl`
- `rounded-[2rem] border-slate-200 bg-white shadow-xl`
- `space-y-8`

## 4) `SubSectionBlock`
Use on:
- grouped form areas in `/exams`, `/rubrics`, `/courses`

JSX skeleton:
```tsx
<div className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 space-y-4">
  {/* fields */}
</div>
```
Key classes:
- `rounded-2xl`
- `border-slate-200/80`
- `bg-white/70`
- `p-6 space-y-4`

## 5) `DropzoneLikeInput`
Use on:
- file upload zones (`/exams`, `/courses` lecture upload variants)

JSX skeleton:
```tsx
<input id="file" type="file" className="sr-only" />
<label
  htmlFor="file"
  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center transition-colors hover:border-slate-400 hover:bg-slate-50"
>
  ...
</label>
```
Key classes:
- `sr-only` for native input
- `border-dashed border-slate-300`
- hover transitions with slate tones

## 6) `TechnicalDetailsDisclosure`
Use on:
- places where IDs/debug info are needed but hidden by default (`/exams`, `/reviews`, `/rubrics`)

JSX skeleton:
```tsx
<details className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
  <summary className="cursor-pointer font-medium text-slate-700">Technical details</summary>
  {/* ids / copy button */}
</details>
```
Key classes:
- `text-xs`
- muted slate bg/border
- progressive disclosure pattern

## 7) `StatusTimelineCard`
Use on:
- async flow statuses in `/reviews` and long-running operations

JSX skeleton:
```tsx
<Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
  <CardContent className="space-y-4">{/* steps */}</CardContent>
</Card>
```
Key classes:
- `rounded-3xl`
- `bg-white/90`
- long soft shadow + `backdrop-blur-sm`

## 8) `PrimaryActionButton`
Use on:
- main action of each screen (`Upload`, `Save`, `Check`)

JSX skeleton:
```tsx
<Button className="h-12 w-full rounded-xl bg-slate-900 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-slate-800">
  ...
</Button>
```
Key classes:
- dark primary tone: `bg-slate-900 hover:bg-slate-800`
- large action height: `h-12`
- full-width where action is primary
