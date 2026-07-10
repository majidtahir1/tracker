# Light Mode (default) with Dark Toggle — Design

**Date:** 2026-07-10
**Status:** Approved design, pending implementation plan

## Goal

The app currently ships an unconditional dark theme. Make **light mode the default**, and add a
**toggle** that lets users switch to dark. The choice is **remembered** across reloads and there is
**no flash** of the wrong theme on load.

## Current state (as explored)

- **Tailwind CSS v4**, CSS-first config. All theming lives in one `@theme { … }` block in
  `app/globals.css` (lines 3–72). No `tailwind.config`, no styled-components, no CSS modules.
- Colors are consumed as semantic utility classes (`bg-surface`, `text-text-2`, `bg-accent`,
  `border-border`, …) — **~916 usages across 56 files**, all routed through `--color-*` tokens.
- **No theme-switching mechanism exists**: no `next-themes`, no provider, no `dark:` variants, no
  `prefers-color-scheme`. The dark hex values are hardcoded and unconditional.
- Root layout `app/layout.tsx`: `<html>` carries only font-variable classes; `<body>` gets colors
  from the `body { @apply bg-bg text-text-2 }` rule. Nothing selects a theme today.
- **Recharts** components use literal hex strings (Recharts can't take CSS classes). Central file
  `components/charts/ChartTheme.tsx` duplicates token hex as JS constants; ~7 scattered literals
  bypass it (listed in "Chart theming" below).

## Decisions (from brainstorming)

- **Scope:** light default **+ toggle to dark**, with persistence. (Not light-only; not system-only.)
- **Accent in light mode:** a **distinct** accent — **deep indigo `#4F46E5`** (the lime `#A3E635`
  fails contrast on white). Dark mode keeps its existing lime accent unchanged.
- **Chart theming:** **full** — make `ChartTheme` runtime/theme-aware and fix all scattered literals.
- **Toggle placement:** sidebar footer (desktop) + mobile "More" sheet. (No settings page exists.)
- **No new dependency:** hand-roll a small provider rather than add `next-themes`.

## Architecture

Tailwind v4's `@theme` generates **static** utilities, so we can't define two live palettes in two
`@theme` blocks. We use **indirection variables**:

1. In `@theme`, each color token points at a plain CSS variable:
   `--color-bg: var(--bg);` … `--color-accent: var(--accent);` (and so on for every color token,
   including `-muted`/`-border` variants, status colors, and chart colors).
2. Actual values are defined **twice** in plain CSS after the `@theme` block:
   - `:root { … }` → **light** values (the default).
   - `:root[data-theme="dark"] { … }` → the **current dark** values (moved verbatim from `@theme`).
3. Non-color tokens (fonts, radius, spacing) stay directly in `@theme` — they don't change per theme.
   **Shadows** and `--shadow-pr` do change and move into the `:root` / `[data-theme="dark"]` blocks.

### No-flash inline script

A tiny synchronous script injected into `<html>` (in `app/layout.tsx`, before `<body>` paints) reads
`localStorage.theme` and sets `document.documentElement.dataset.theme` accordingly:

```js
// runs before first paint — prevents flash of wrong theme
(function () {
  try {
    var t = localStorage.getItem("theme");
    if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
    // no stored value → no attribute → :root light defaults apply
  } catch (e) {}
})();
```

Added via a `<script dangerouslySetInnerHTML>` in `<head>`. `<html>` gets `suppressHydrationWarning`
because the script mutates it before React hydrates.

### Provider + hook (hand-rolled, ~30–40 lines)

`components/theme/ThemeProvider.tsx` (client component):

- `ThemeProvider` — React context holding `theme: "light" | "dark"` and `toggle()` / `setTheme()`.
  On mount, reads the current `data-theme` (or `localStorage`) to initialize state so UI matches the
  pre-paint script. `setTheme` updates state, writes `localStorage.theme`, and sets
  `document.documentElement.dataset.theme`.
- `useTheme()` — hook returning `{ theme, toggle, setTheme }`.

`ThemeProvider` wraps the app in `app/layout.tsx` (inside `<body>`).

### Toggle control

`components/theme/ThemeToggle.tsx` — a small button using `useTheme()`, showing a `Sun` icon in dark
mode and `Moon` in light mode (lucide-react, already a dependency). Styled to match existing sidebar
footer controls (same `RING` focus style, `text-text-3 hover:text-text-2`). `aria-label` reflects the
action ("Switch to dark mode" / "Switch to light mode").

Placed in:
- `components/layout/Sidebar.tsx` footer, in the row alongside the username / Sign-out.
- `components/layout/MobileNav.tsx` "More" sheet, alongside its Sign-out action.

## Light palette (`:root`)

Backgrounds / borders / text:

| Token | Light | (Dark, for reference) |
|---|---|---|
| `--bg` | `#F7F8FA` | `#0A0B0D` |
| `--bg-subtle` | `#F1F3F5` | `#101114` |
| `--surface` | `#FFFFFF` | `#16181C` |
| `--surface-2` | `#F7F8FA` | `#1D2025` |
| `--surface-3` | `#EDEFF2` | `#24282E` |
| `--border` | `#E3E6EA` | `#24272D` |
| `--border-strong` | `#CDD2D8` | `#33373F` |
| `--border-faint` | `#EDEFF2` | `#1A1C20` |
| `--text` | `#16181C` | `#F2F4F5` |
| `--text-2` | `#4A5158` | `#A8AFB8` |
| `--text-3` | `#767D86` | `#666D78` |
| `--text-faint` | `#A3AAB2` | `#43484F` |

Accent (indigo) — light:

| Token | Light |
|---|---|
| `--accent` | `#4F46E5` |
| `--accent-hover` | `#4338CA` |
| `--accent-press` | `#3730A3` |
| `--accent-text` | `#FFFFFF` (text ON accent) |
| `--accent-muted` | `#4F46E514` (8% tint) |
| `--accent-border` | `#4F46E540` (25% tint) |

Status — light (darkened bases for white-bg contrast; pale muted tints):

| Token | Light |
|---|---|
| `--success` / `--success-muted` | `#16A34A` / `#DCFCE7` |
| `--warning` / `--warning-muted` | `#D97706` / `#FEF3C7` |
| `--danger` / `--danger-muted` | `#DC2626` / `#FEE2E2` |
| `--info` / `--info-muted` | `#2563EB` / `#DBEAFE` |

Charts — light (legible on white; series roles preserved):

| Token | Light | Role |
|---|---|---|
| `--chart-1` | `#4F46E5` | primary (indigo) |
| `--chart-2` | `#0EA5E9` | body weight (sky) |
| `--chart-3` | `#DB2777` | push (pink) |
| `--chart-4` | `#D97706` | pull (amber) |
| `--chart-5` | `#7C3AED` | legs (violet) |
| `--chart-6` | `#0D9488` | arms/recovery (teal) |

Shadows — light:

| Token | Light |
|---|---|
| `--shadow-card` | `0 1px 2px 0 rgb(16 24 40 / 0.06), 0 1px 3px 0 rgb(16 24 40 / 0.04)` |
| `--shadow-raise` | `0 8px 24px -8px rgb(16 24 40 / 0.16)` |
| `--shadow-pr` | `0 0 0 1px #4F46E540, 0 0 24px -4px #4F46E559` |

(Dark keeps its existing inset-white-highlight shadows verbatim.)

## Chart theming (full)

Recharts needs literal color strings, so charts can't inherit CSS classes. Fix:

- **`components/charts/ChartTheme.tsx`** becomes theme-aware: instead of hardcoded JS hex constants,
  it reads the resolved CSS custom properties at runtime via
  `getComputedStyle(document.documentElement).getPropertyValue('--chart-1')` (etc.), and re-reads when
  the theme changes. Exposed through a **`useChartTheme()`** hook returning the current
  `{ colors, bg, grid, axisText, … }`. It re-computes when `useTheme().theme` changes.
- Server/first-render safety: provide sensible **light defaults** as the initial value so charts
  render correctly before the effect runs (SSR has no `getComputedStyle`).
- **Route the scattered literals through the hook** so they recolor on toggle:
  - `components/analytics/E1rmChart.tsx:78` (`stroke: "#0A0B0D"`)
  - `components/measurements/MetricCardGrid.tsx:90` (`stroke: "#0A0B0D"`)
  - `components/analytics/BodyWeightChart.tsx:47-48` (`#43484F`, `#0A0B0D`)
  - `components/analytics/RecoveryPerformanceChart.tsx:54` (cursor/label fills)
  - `components/analytics/WeeklyMuscleVolumeChart.tsx:56,70`
  - `components/analytics/WhoopSleepChart.tsx:56`
  - `app/analytics/page.tsx:26` (`BIG_FOUR_COLORS`) → derive from `useChartTheme()` chart colors.

## Testing / verification

- **No-flash:** load app with `localStorage.theme = "dark"` and with none set; confirm no light→dark
  (or dark→light) flash on first paint.
- **Toggle:** switch light↔dark in sidebar and mobile "More" sheet; confirm instant recolor and that
  the choice survives a reload.
- **Contrast spot-check:** accent text/buttons, status colors, and body text pass WCAG AA on light.
- **Charts:** open analytics pages in both themes; confirm every chart (including the 7 fixed
  literals) recolors and stays legible (grid, axis text, cursors, series).
- **Regression:** dark mode is visually unchanged from today (values moved, not altered).

## Out of scope

- System-preference (`prefers-color-scheme`) auto-follow. (Explicit toggle only; default = light.)
- Per-component redesign — this is a palette + mechanism change, not a visual redesign.
- Redesigning the dark theme.
