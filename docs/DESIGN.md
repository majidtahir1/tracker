# DESIGN.md — Hypertrophy Tracker Design System (v1)

This is the single source of truth for all UI in this app. Every class string, hex value, and layout rule here is normative. If a screen is not covered, compose it from these tokens and components — do not invent new colors, radii, or shadows.

---

## 1. Design Direction

**Mood: "Midnight Iron."** A near-black, low-glare canvas built for a gym at 6am and a desk at midnight. The aesthetic is athletic-precision, not gamer-RGB: deep neutral charcoals with a faint cold cast, hairline borders instead of heavy card chrome, generous negative space, and numbers as the heroes — big, tabular, confident. The single accent is **volt green (#A3E635)** — the color of a stoplight going green, of "go lift" — used sparingly for the primary action, active states, positive trends, and the PR moment. Everything else stays quiet: warm-gray text hierarchy, muted chart tones, restrained motion. Think Whoop's data confidence, Linear's typographic discipline, Vercel's black-on-black surface language. No purple gradients, no glassmorphism blur soup, no neon glows except the one earned moment: hitting a PR.

Light mode does not exist in v1. The app is dark-mode-only by design.

---

## 2. Design Tokens

### 2.1 Fonts (next/font/google)

- **UI font:** `Inter` — all body, labels, nav, tables. Variable `--font-sans`.
- **Display/numeric font:** `Space Grotesk` — big stat numbers, page titles, PR values. Variable `--font-display`.
- **Mono (tiny usage):** `JetBrains Mono` — set-log inline history like `185×8 @2`. Variable `--font-mono`.

```ts
// app/fonts.ts
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
export const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
export const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
export const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
// <body className={`${inter.variable} ${grotesk.variable} ${mono.variable} font-sans`}>
```

### 2.2 Tailwind v4 `@theme` (app/globals.css)

```css
@import "tailwindcss";

@theme {
  /* ---- Background layers (deepest → raised) ---- */
  --color-bg:        #0A0B0D; /* app canvas */
  --color-bg-subtle: #101114; /* page-section wells, sidebar */
  --color-surface:   #16181C; /* cards */
  --color-surface-2: #1D2025; /* raised: hover rows, inputs, steppers */
  --color-surface-3: #24282E; /* pressed / active-input */

  /* ---- Borders ---- */
  --color-border:        #24272D; /* default hairline */
  --color-border-strong: #33373F; /* hover / focused card */
  --color-border-faint:  #1A1C20; /* dividers inside cards */

  /* ---- Text hierarchy ---- */
  --color-text:        #F2F4F5; /* primary — headings, stat numbers */
  --color-text-2:      #A8AFB8; /* secondary — body, values in tables */
  --color-text-3:      #666D78; /* tertiary — labels, captions, units */
  --color-text-faint:  #43484F; /* disabled, placeholders */

  /* ---- Accent: volt ---- */
  --color-accent:        #A3E635; /* lime-400 family; primary actions, active nav */
  --color-accent-hover:  #B5F04D;
  --color-accent-press:  #8FCF2B;
  --color-accent-text:   #0A0B0D; /* text ON accent — always near-black */
  --color-accent-muted:  #A3E63514; /* 8% tint fills (active nav bg, badges) */
  --color-accent-border: #A3E63540; /* 25% tint borders */

  /* ---- Status ---- */
  --color-success:        #4ADE80;
  --color-success-muted:  #4ADE8014;
  --color-warning:        #FBBF24;
  --color-warning-muted:  #FBBF2414;
  --color-danger:         #F87171;
  --color-danger-muted:   #F8717114;
  --color-info:           #38BDF8;
  --color-info-muted:     #38BDF814;

  /* ---- Chart palette (in order of use) ---- */
  --color-chart-1: #A3E635; /* volt — primary series (e1RM, volume) */
  --color-chart-2: #38BDF8; /* sky — body weight */
  --color-chart-3: #F472B6; /* pink — chest/push groups */
  --color-chart-4: #FBBF24; /* amber — back/pull groups */
  --color-chart-5: #818CF8; /* indigo — legs */
  --color-chart-6: #2DD4BF; /* teal — arms/recovery */

  /* ---- Fonts ---- */
  --font-sans:    var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-display), var(--font-sans), sans-serif;
  --font-mono:    var(--font-mono), ui-monospace, monospace;

  /* ---- Radius ---- */
  --radius-xs: 4px;   /* badges, tiny chips */
  --radius-sm: 8px;   /* buttons, inputs, table cells */
  --radius-md: 12px;  /* cards */
  --radius-lg: 16px;  /* hero cards, modals */
  --radius-full: 9999px;

  /* ---- Shadows (dark-tuned: shadow + inner top highlight) ---- */
  --shadow-card:  0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 1px 2px 0 rgb(0 0 0 / 0.4);
  --shadow-raise: 0 1px 0 0 rgb(255 255 255 / 0.05) inset, 0 8px 24px -8px rgb(0 0 0 / 0.6);
  --shadow-pr:    0 0 0 1px #A3E63540, 0 0 24px -4px #A3E63559;

  /* ---- Spacing: use Tailwind default 4px scale. Canonical rhythm: ----
     p-4 inside compact cards, p-5 standard cards, p-6 hero cards,
     gap-4 grids on mobile, gap-5 on desktop, space-y-8 between page sections. */
}
```

**Global base styles** (also in globals.css):

```css
body { @apply bg-bg text-text-2 antialiased; }
::selection { @apply bg-accent/25 text-text; }
```

**Focus ring recipe (use everywhere):** `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg`
Referenced below as `«ring»`.

---

## 3. Component Specs

All recipes are literal class strings. `«ring»` = the focus recipe above.

### 3.1 Stat Card (dashboard hero row)

```
Card:   rounded-md border border-border bg-surface p-5 shadow-[var(--shadow-card)]
        hover:border-border-strong transition-colors
Header: flex items-center justify-between →
  Label: text-xs font-medium uppercase tracking-wider text-text-3
  Icon:  size-4 text-text-3           (lucide icon per §6)
Value:  mt-2 font-display text-3xl font-semibold tracking-tight text-text tabular-nums
Unit:   ml-1 text-base font-normal text-text-3   (inside value line, e.g. "lb", "kcal")
Trend row: mt-1.5 flex items-center gap-1 text-xs tabular-nums
  Up-good:   text-success  + <TrendingUp className="size-3.5"/>  e.g. "+2.4% vs last wk"
  Down-bad:  text-danger   + <TrendingDown className="size-3.5"/>
  Neutral:   text-text-3   + <Minus className="size-3.5"/>
```

### 3.2 Page Shell + Navigation

**Desktop (`lg:` and up):** fixed left sidebar, `w-60`, full height.

```
Sidebar:    fixed inset-y-0 left-0 hidden lg:flex w-60 flex-col border-r border-border bg-bg-subtle
Logo row:   flex h-16 items-center gap-2.5 px-5 border-b border-border-faint
            → <Dumbbell className="size-5 text-accent"/> + font-display text-[15px] font-semibold text-text tracking-tight ("TRACKER")
Nav list:   flex-1 space-y-0.5 p-3
Nav item:   flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium text-text-3
            hover:bg-surface hover:text-text-2 transition-colors «ring»
Active:     bg-accent-muted text-accent  (icon inherits color; NO left bar, the tint is enough)
Icon:       size-[18px] shrink-0
Footer:     p-3 border-t border-border-faint → block/week chip:
            rounded-sm bg-surface px-3 py-2 text-xs text-text-3 → "Block 2 · Week 6" with
            font-mono text-accent for the numbers
Main:       lg:pl-60 → inner: mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8
Page title: font-display text-2xl font-semibold tracking-tight text-text
Page sub:   mt-1 text-sm text-text-3
```

**Mobile (`< lg`):** bottom tab bar, 5 slots (Dashboard, Workout, Analytics, Calendar, More).

```
Bar:  fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border
      bg-bg-subtle/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:hidden
Tab:  flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-text-3 «ring»
      → icon size-5; Active: text-accent
Main content gets pb-24 lg:pb-8 to clear the bar.
"More" opens a sheet listing the remaining pages (Measurements, Nutrition, Recovery, Goals, Exercises, Notifications).
```

### 3.3 Section Card (generic container)

```
Card:    rounded-md border border-border bg-surface shadow-[var(--shadow-card)]
Header:  flex items-center justify-between border-b border-border-faint px-5 py-4
  Title: text-sm font-semibold text-text
  Action:text-xs font-medium text-text-3 hover:text-accent transition-colors ("View all →")
Body:    p-5   (or p-0 when the body is a table/list)
```

### 3.4 Data Table

```
Wrapper: overflow-x-auto  (inside a Section Card with p-0 body)
Table:   w-full text-sm
thead th: px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-3
          border-b border-border  — numeric columns add text-right
tbody tr: border-b border-border-faint last:border-0 hover:bg-surface-2 transition-colors
tbody td: px-5 py-3.5 text-text-2 — numeric: text-right tabular-nums text-text
Row link rows: cursor-pointer
Empty numeric cell: text-text-faint "—"
```

### 3.5 Chart Card

```
Card:    Section Card recipe; Body: px-2 pb-4 pt-4 (charts need bleed room)
Height:  h-64 on dashboard grid, h-80 on Analytics
Legend:  flex gap-4 px-3 pb-2 text-xs text-text-3 → swatch: size-2 rounded-full bg-[chart-n]
Range toggle (header right): inline-flex rounded-sm border border-border bg-bg-subtle p-0.5
  → buttons: rounded-[6px] px-2.5 py-1 text-xs font-medium text-text-3 «ring»
    active: bg-surface-2 text-text
  Options: 4W / 12W / 6M / All
Chart styling rules: see §5.3.
```

### 3.6 Badges

```
Base:    inline-flex items-center gap-1 rounded-xs px-2 py-0.5 text-[11px] font-semibold
Neutral: bg-surface-2 text-text-3
Success: bg-success-muted text-success
Warning: bg-warning-muted text-warning
Danger:  bg-danger-muted text-danger
Info:    bg-info-muted text-info
Deload:  bg-info-muted text-info → "DELOAD"
Priority:High → warning style "HIGH"; Highest → accent style "FOCUS"
Accent:  bg-accent-muted text-accent border border-accent-border
```

**PR Badge — the achievement moment.** Larger, glowing, animated once on mount:

```
<span class="inline-flex items-center gap-1.5 rounded-full border border-accent-border
  bg-accent-muted px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-accent
  shadow-[var(--shadow-pr)] animate-pr-pop">
  <Trophy class="size-3.5" /> PR
</span>
```

```css
@keyframes pr-pop { 0% {transform:scale(.6);opacity:0} 60% {transform:scale(1.12)} 100% {transform:scale(1);opacity:1} }
.animate-pr-pop { animation: pr-pop .45s cubic-bezier(.2,1.4,.4,1) both; }
```

Variants append type: `PR · WEIGHT`, `PR · e1RM`, `PR · REPS`, `PR · VOLUME`.

### 3.7 Progress Bar

```
Track: h-2 w-full overflow-hidden rounded-full bg-surface-2
Fill:  h-full rounded-full bg-accent transition-[width] duration-500 ease-out
       — style={{width: `${pct}%`}}
       ≥100%: bg-success; behind-pace variant (goals page only): bg-warning
Label row above: flex items-baseline justify-between text-xs →
  left: text-text-3 (name); right: tabular-nums text-text-2 "185 / 225 lb"
Thick variant (Goals): h-3
```

### 3.8 Buttons

All: `inline-flex items-center justify-center gap-2 rounded-sm text-sm font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none «ring»`

```
Primary: bg-accent text-accent-text hover:bg-accent-hover active:bg-accent-press
Ghost:   border border-border bg-transparent text-text-2 hover:bg-surface-2 hover:text-text hover:border-border-strong
Danger:  bg-danger-muted text-danger border border-danger/25 hover:bg-danger/25
Subtle (tertiary, text-only): text-text-3 hover:text-text hover:bg-surface-2

Sizes:  sm → h-8 px-3 text-xs;  md (default) → h-10 px-4;  lg → h-12 px-6 text-base
Gym-critical CTAs (Start Workout, Finish Workout): lg + w-full sm:w-auto
Icon button: size-9 p-0 (md), size-8 p-0 (sm) — icon size-4, Ghost styling
```

### 3.9 Form Inputs (dark, big touch targets)

```
Label:  mb-1.5 block text-xs font-medium text-text-3
Input:  h-12 w-full rounded-sm border border-border bg-surface-2 px-3.5 text-base text-text
        placeholder:text-text-faint hover:border-border-strong
        focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/25
        transition-colors
Numeric inputs: text-right tabular-nums font-display text-lg + inputMode="decimal"
Select: same as Input + appearance-none bg-no-repeat pr-10 with <ChevronDown> absolutely
        positioned right-3 text-text-3 pointer-events-none
Textarea: min-h-24 py-3 (rest same as Input)
Field error: mt-1.5 text-xs text-danger; input gains border-danger/60 focus:ring-danger/25
Slider rows (Recovery 1–10): five/ten segment buttons —
  flex gap-1 → each: h-11 flex-1 rounded-xs bg-surface-2 text-sm tabular-nums text-text-3
  selected: bg-accent text-accent-text font-semibold
```

### 3.10 Set-Logging Row (the most-touched component in the app)

One row per set. Thumb zone: everything actionable ≥ 44px. Layout is a grid:
`grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-2 py-2` on mobile; steppers dominate.

```
Set # chip:  size-9 shrink-0 rounded-full bg-surface-2 grid place-items-center
             text-sm font-semibold tabular-nums text-text-3
             — completed: bg-accent text-accent-text; warm-up set: text-text-faint "W"

Stepper (Weight and Reps — identical shell):
  Shell:  flex h-14 items-stretch overflow-hidden rounded-sm border border-border bg-surface-2
  − btn:  w-11 grid place-items-center text-text-3 active:bg-surface-3 «ring»
          → <Minus class="size-5"/>
  Value:  flex-1 min-w-14 grid place-items-center font-display text-xl font-semibold
          tabular-nums text-text
          — value is ALSO a real <input inputMode="decimal"> (bg-transparent text-center
            border-0 focus:ring-0) so tapping the number allows direct typing
  + btn:  w-11 grid place-items-center text-text-3 active:bg-surface-3 «ring»
          → <Plus class="size-5"/>
  Micro-label above shell: text-[10px] uppercase tracking-wider text-text-3 ("LB" / "REPS")
  Weight increments ±5, long-press ±2.5. Reps increments ±1.

RIR control: segmented, values 0 1 2 3+ —
  inline-flex h-14 rounded-sm border border-border bg-surface-2 p-1 gap-1
  → each: w-10 rounded-xs grid place-items-center text-sm tabular-nums text-text-3
    selected: bg-surface-3 text-text font-semibold
    (on <sm screens RIR collapses to a compact stepper like Reps, w-24)

Done check: size-11 shrink-0 rounded-sm border border-border grid place-items-center
            text-text-faint «ring» → <Check class="size-5"/>
            completed: bg-accent border-accent text-accent-text

Previous-session ghost line (under the row, always visible):
  pl-11 font-mono text-xs text-text-faint → "prev  185 × 8 · RIR 2"
  If this session beats it: value that improved renders text-success.

Completed row state: entire row bg-accent-muted/50 rounded-sm; steppers dim to opacity-70.
Add set: Ghost button sm w-full mt-1 → <Plus class="size-4"/> "Add set"
```

### 3.11 Calendar Day Cell

Grid: `grid grid-cols-7 gap-1.5`; cell base:

```
Base:      aspect-square rounded-sm border border-transparent p-1.5 text-left «ring»
Day num:   text-xs tabular-nums text-text-3
Dot row:   absolute bottom-1.5 left-1.5 flex gap-1 (cell is relative)

States:
  Rest day:        bg-transparent; day num text-text-faint
  Completed:       bg-surface border-border; day num text-text-2;
                   dot: size-1.5 rounded-full bg-success
                   (hover reveals tooltip: workout name + volume)
  Missed:          bg-transparent; dot: size-1.5 rounded-full bg-danger; day num text-text-3
  Deload week day: bg-info-muted/50; day num text-info; tiny "D" text-[9px] text-info top-right
  Today:           ring-1 ring-accent border-accent/40; day num text-accent font-semibold
  Reminder (photo/measurement due): <Camera|Ruler class="size-3 text-warning"/> top-right
  Future scheduled:day num text-text-3; hollow dot: size-1.5 rounded-full border border-text-faint
Legend under grid: flex flex-wrap gap-4 text-xs text-text-3 with matching dots.
```

### 3.12 Notification Toast & List Item

```
Toast: fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-50 w-[calc(100%-2rem)] max-w-sm
       rounded-md border border-border bg-surface-2 p-4 shadow-[var(--shadow-raise)]
       flex gap-3 animate-toast-in
  Icon slot: size-8 shrink-0 rounded-sm grid place-items-center
       progression → bg-accent-muted text-accent <TrendingUp size-4>
       deload      → bg-info-muted text-info <BatteryLow size-4>
       reminder    → bg-warning-muted text-warning <Bell size-4>
       PR          → bg-accent-muted text-accent <Trophy size-4> + card gets shadow-[var(--shadow-pr)]
  Title: text-sm font-semibold text-text;  Body: mt-0.5 text-xs text-text-3
  Dismiss: icon button sm, absolute top-2 right-2

@keyframes toast-in { from {transform:translateY(12px);opacity:0} to {transform:none;opacity:1} }
.animate-toast-in { animation: toast-in .25s ease-out both; }

Notification list item (Notifications page / dropdown):
  flex gap-3 px-5 py-4 border-b border-border-faint hover:bg-surface-2 transition-colors
  — same icon slot; unread: size-1.5 rounded-full bg-accent self-center shrink-0 (left edge)
  Timestamp: text-[11px] text-text-faint mt-1
```

### 3.13 Empty States

```
Wrapper: flex flex-col items-center justify-center rounded-md border border-dashed
         border-border py-16 px-6 text-center
Icon:    size-10 text-text-faint (page's own nav icon)
Title:   mt-4 text-sm font-semibold text-text
Body:    mt-1 max-w-xs text-xs text-text-3
CTA:     mt-5 Primary button sm — always present, always action-first
Copy is athletic and direct: "No sets logged yet." / "First session's the baseline. Start Monday's Push workout."
Chart empty state: same, inside chart body, no dashed border, icon <LineChart>.
```

---

## 4. Per-Page Layout Sketches

Global: every page starts with the title block (§3.2), sections separated by `space-y-8`.

### 4.1 Dashboard
1. **Title row** — "Dashboard" + right-aligned chip `Block 2 · Week 6 · Deload in 7 wks` (Neutral badge, lg).
2. **Hero stat row** — `grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6`: Body Weight (trend), Weekly Volume (trend), Recovery Score (colored value: ≥7 success / 4–6 warning / <4 danger), PRs This Block, Streak (consecutive weeks), Calories/Protein Today (dual line).
3. **Next Workout card** — full-width hero card `rounded-lg p-6 lg:flex justify-between items-center`, left: label "NEXT WORKOUT" (text-3 caps) + `font-display text-2xl` "Push Dominant Upper" + meta line "8 exercises · ~75 min · Mon" + up to 3 progression Accent badges ("Bench +5 lb ready"); right: **Start Workout** Primary lg button with `<Play>` icon. This is the visual anchor of the page.
4. **Charts grid** — `grid gap-5 lg:grid-cols-2`: Body Weight (chart-2), Estimated 1RM multi-line (Bench/Squat/RDL/OHP = chart-1/3/4/5), Weekly Volume bars (chart-1), Muscle-Group Volume stacked bars vs target line.
5. **Bottom row** — `grid gap-5 lg:grid-cols-2`: Last Workout summary (Section Card: name, date, volume, PR badges, per-exercise mini-table) + Notifications list (top 5).

### 4.2 Workout Logging (the money screen)
Mobile-first. **Scrollable list of exercise cards, one "active" at a time** (active = expanded; others collapse to summary rows). No pagination — scroll is faster in the gym.

1. **Sticky header** — `sticky top-0 z-30 bg-bg/90 backdrop-blur-md border-b border-border px-4 py-3`: workout name (font-display text-lg), elapsed sets counter "12/26 sets", right: **Finish** (Primary sm) + overflow menu (cancel).
2. **Progression banner** (when engine recommends) — full-width above the exercise: `rounded-sm border border-accent-border bg-accent-muted px-4 py-3 flex gap-3 items-center text-sm` → `<TrendingUp class="text-accent">` + "**All sets hit 8 last time.** Load 190 lb today." + Ghost sm "Keep 185". Deload/fatigue variant uses info colors + `<BatteryLow>`.
3. **Exercise card (expanded)** — Section Card. Header: exercise name (text-base font-semibold) + Priority badge + target chip `3 × 6–8 · RIR 1–2 · rest 2–3m` (text-xs text-3) + `<Info>` icon button → exercise detail sheet. Body: set-logging rows (§3.10) stacked with previous-session ghost lines, then "Add set". Footer strip: live totals `Volume 4,440 lb · e1RM 231` (font-mono text-xs text-3); PR badge pops here the instant a PR is detected.
4. **Exercise card (collapsed)** — single row: status ring (done = accent check), name, `3/3 sets` tabular, chevron. Tap to expand (auto-collapses previous, auto-scrolls into view).
5. **Bottom sticky bar (mobile)** — mirrors set counter + Finish button, `pb-[env(safe-area-inset-bottom)]`.
6. Substituting an exercise: overflow item "Swap exercise" → sheet of replacements from library; history continuity noted in text-xs text-3.

### 4.3 Analytics
1. Title + global range toggle (4W/12W/6M/All) top-right.
2. **Big-four progress** — `grid gap-5 lg:grid-cols-2`: e1RM line charts for Bench, Box Squat, RDL, Shoulder Press (chart-1 line each, PR points marked with accent dots + Trophy tooltip).
3. **Volume by muscle group** — horizontal bar chart card, actual (accent) vs weekly target (hollow/track bar), full width.
4. **Row** — Frequency heat strip (weeks × days, cells like mini calendar) + Consistency stat card cluster (completion %, avg RIR, sessions/wk).
5. **Recovery vs Performance** — dual-axis line (recovery score chart-6, weekly volume chart-1) + Body-weight trend with 7-day moving average (raw dots text-faint, MA line chart-2).

### 4.4 Calendar
1. Month title + prev/next icon buttons + "Today" Ghost sm.
2. Full-width Section Card containing the 7-col grid (§3.11), weekday header row `text-xs text-text-3 uppercase`.
3. Legend row under grid.
4. **Selected-day panel** below (mobile) / right rail `lg:w-80` (desktop): workout summary or "Rest day", reminders due, quick link to that session's log.

### 4.5 Measurements & Photos
Tabs (`inline-flex` toggle like range toggle, lg size): **Measurements | Photos**.
- Measurements: top — "Log measurements" Primary button (opens form sheet: 10 numeric inputs §3.9, two-col grid). Below — `grid gap-5 lg:grid-cols-2` of small sparkline chart cards per measurement (h-40), each with current value stat + delta badge vs last month.
- Photos: month-grouped timeline; each entry `grid grid-cols-3 gap-2` (front/side/back, `rounded-sm object-cover aspect-[3/4]`), caption row: date + weight + BF% (font-mono text-xs text-3). Sticky "Add photos" Primary button. Empty state uses `<Camera>`.

### 4.6 Nutrition & Recovery Quick-Log
Both are speed forms — one screen, no scrolling on mobile if possible.
- **Nutrition:** date pill (defaults today), 6 numeric inputs (Calories, Protein, Carbs, Fat, Fiber, Water) in `grid grid-cols-2 gap-3`, each with unit suffix inside input (absolute right-3 text-text-3 text-sm). Under form: "This week avg" strip — 6 mini stats tabular-nums with target deltas (protein under target = warning text). Save = Primary lg w-full.
- **Recovery:** segment-button rows (§3.9 slider rows) for Sleep quality, Stress, Energy, Motivation, Workout difficulty, Soreness (1–10) + Sleep hours stepper (±0.5). Computed **Recovery Score** renders live at top as a big `font-display text-5xl tabular-nums` number in a colored ring (`size-24 rounded-full border-4`, border color by score band). Save = Primary lg w-full.

### 4.7 Goals
List of goal rows in one Section Card, `divide-y divide-border-faint`, each row `px-5 py-4`:
icon (per stat, §6) + name + thick progress bar (§3.7) + right-aligned `tabular-nums` "285 / 315 lb" + tiny projection caption `text-[11px] text-text-faint` "on pace · ~Oct 2026". Completed goals: success fill + `<CheckCircle2 class="text-success">` + strikethrough-free, just green. Header action: "Edit goals".

---

## 5. Motion & Polish

### 5.1 Interaction rules
- **Durations:** color/opacity 150ms, transform 200ms, layout/width 300–500ms `ease-out`. Never animate on scroll.
- Cards: hover = `border-border-strong` only. No lift/scale on cards.
- Buttons: color transition only; `active:scale-[0.98]` allowed on Primary lg gym CTAs.
- Steppers: value change triggers a 120ms scale pulse on the number (`scale(1.06)→1`).
- Expand/collapse (exercise cards, sheets): height auto-animate 250ms ease-out; chevron `rotate-180 transition-transform duration-200`.
- Respect `prefers-reduced-motion: reduce` → disable pr-pop, toast-in, pulses (fade only).
- PR moment: pr-pop badge + one subtle 600ms accent glow on the exercise card border. No confetti.

### 5.2 Number formatting
- All metrics: `tabular-nums`. Big stats additionally `font-display tracking-tight`.
- Weight: 1 decimal max, strip trailing zero → `185`, `187.5`. Volume ≥10k: thin-space grouping via `toLocaleString` → `12,480 lb`. e1RM: integers. Percentages: 1 decimal. Deltas always signed: `+5 lb`, `−1.2%` (use true minus U+2212).

### 5.3 Chart styling (Recharts)
- Background: transparent (card provides surface). Margins tight: `{top:8,right:8,bottom:0,left:0}`.
- Gridlines: horizontal only, `stroke=#24272D`, `strokeDasharray="3 6"`, no vertical lines.
- Axes: no axis lines, no ticks lines; labels `fill=#666D78 fontSize=11` tabular. Y-axis 4 ticks max, domain padded 5%.
- Lines: `strokeWidth=2`, `dot=false`, `activeDot={r:4, fill:series, stroke:#0A0B0D, strokeWidth:2}`. Curves: `monotone`.
- **Gradient under primary lines** (Area): series color at 18% opacity → 0% at bottom; only on single-series charts.
- Bars: `radius=[4,4,0,0]`, `fill=series`, hover state via `fillOpacity 0.8→1`, category gap 30%.
- Tooltip: custom — `rounded-sm border border-border bg-surface-2 px-3 py-2 text-xs shadow-[var(--shadow-raise)]`; label text-text-3, values text-text tabular-nums with series dot; cursor line `stroke=#33373F`.
- PR markers: `<ReferenceDot r=3.5 fill=#A3E635 stroke=#0A0B0D>`.
- Target lines (volume targets, goal weight): `ReferenceLine stroke=#666D78 strokeDasharray="4 4"` + right-edge label.

---

## 6. Iconography — lucide-react only

Default size `size-[18px]` nav, `size-4` inline/stat, `strokeWidth={2}` everywhere (1.75 on size-10+ empty-state icons).

**Nav:**
| Page | Icon |
|---|---|
| Dashboard | `LayoutDashboard` |
| Workout (today/log) | `Dumbbell` |
| Analytics | `LineChart` |
| Calendar | `CalendarDays` |
| Exercises (library) | `Library` |
| Measurements/Photos | `Ruler` |
| Nutrition | `Apple` |
| Recovery | `HeartPulse` |
| Goals | `Target` |
| Notifications | `Bell` |
| More (mobile) | `Ellipsis` |

**Stats & semantics:**
| Concept | Icon |
|---|---|
| Body weight | `Scale` |
| Weekly volume | `BarChart3` |
| Recovery score | `HeartPulse` |
| Streak / consistency | `Flame` |
| PR / achievement | `Trophy` |
| Calories | `Flame` (nutrition context) / Protein `Beef` |
| Water | `Droplets` |
| Sleep | `Moon` |
| e1RM / strength | `TrendingUp` |
| Deload | `BatteryLow` |
| Rest timer/time meta | `Clock` |
| Start workout | `Play` |
| Finish workout | `CheckCheck` |
| Add / stepper + | `Plus` · − `Minus` |
| Set done | `Check` |
| Trend up/down/flat | `TrendingUp` / `TrendingDown` / `Minus` |
| Photos | `Camera` |
| Swap exercise | `ArrowLeftRight` |
| Exercise info | `Info` |
| Edit | `Pencil` · Delete `Trash2` |
| Bench press goal | `Dumbbell`; Squat `Dumbbell`; body-fat `Percent` |

---

**Consistency checklist for implementers:** every card is `bg-surface border-border rounded-md`; every number is `tabular-nums`; volt appears only on (a) the primary action per screen, (b) active nav, (c) positive/PR moments, (d) primary chart series — if a screen shows volt more than ~4 times, remove some.
