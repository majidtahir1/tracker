# Light Mode (default) with Dark Toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make light mode the app's default theme and add a persisted toggle to switch to dark, with no flash on load and all charts recoloring correctly.

**Architecture:** Tailwind v4 `@theme` color tokens are redirected to plain CSS variables; light values live in `:root`, dark values in `:root[data-theme="dark"]`. A pre-paint inline script + a small hand-rolled `ThemeProvider`/`useTheme` drive the `data-theme` attribute and persist to `localStorage`. Recharts colors (which need literal strings, not CSS classes) are resolved at runtime from the active theme via a new `useChartTheme()` hook.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4 (CSS-first), lucide-react, Recharts. Tests: `node:test` + `node:assert` run via `tsx` (`npm test`).

> **Revision (2026-07-10, post-implementation):** the light accent changed from indigo to **ink
> monochrome + volt data**. Light `--accent`=`#18181B` (hover `#27272A`, press `#000000`, muted
> `#18181B14`, border `#18181B40`); `--chart-1`=`#4D7C0F` (deep volt/lime); `--shadow-pr-v` uses
> `#4D7C0F`. Applied in `app/globals.css` (`:root`) and `ChartTheme.tsx` `LIGHT_FALLBACK`. Where
> tasks below say `#4F46E5`, use these values.

## Global Constraints

- **No new npm dependencies.** Hand-roll the theme provider; do not add `next-themes`.
- **Light is the default** — a user with no stored preference sees light. Dark is opt-in via toggle.
- **Dark mode must be visually unchanged** from today: dark values are moved verbatim, not re-tuned.
- **Light accent is indigo `#4F46E5`** (dark keeps lime `#A3E635`).
- All color changes route through the existing `--color-*` semantic tokens; do not hardcode new hex in components except where Recharts requires literals (handled by `useChartTheme()`).
- `localStorage` key is exactly `"theme"`; valid stored values are `"light"` and `"dark"`.
- Tests run with `npm test` (`TZ=America/New_York tsx --test tests/*.test.ts`).

---

## File Structure

- **Create** `lib/theme.ts` — pure, testable theme helpers (types, storage key, resolve/opposite, init-script string). No React, no DOM side effects.
- **Create** `tests/theme.test.ts` — unit tests for `lib/theme.ts`.
- **Modify** `app/globals.css` — split palette into `:root` (light default) + `:root[data-theme="dark"]`; redirect `@theme` color tokens to `var(--*)`; move shadows.
- **Create** `components/theme/ThemeProvider.tsx` — `"use client"` context provider + `useTheme()` hook.
- **Create** `components/theme/ThemeToggle.tsx` — `"use client"` toggle button using `useTheme()`.
- **Modify** `app/layout.tsx` — inject pre-paint script, `suppressHydrationWarning` on `<html>`, wrap children in `ThemeProvider`.
- **Modify** `components/layout/Sidebar.tsx` — render `ThemeToggle` in the footer.
- **Modify** `components/layout/MobileNav.tsx` — render `ThemeToggle` in the "More" sheet.
- **Modify** `components/charts/ChartTheme.tsx` — add `useChartTheme()` returning runtime-resolved colors + prop objects; keep color-free consts.
- **Modify** the 13 chart consumer files + `app/analytics/page.tsx` — consume `useChartTheme()` for color-bearing values; replace scattered hardcoded literals.

---

## Task 1: Pure theme helpers (`lib/theme.ts`)

**Files:**
- Create: `lib/theme.ts`
- Test: `tests/theme.test.ts`

**Interfaces:**
- Produces:
  - `type Theme = "light" | "dark"`
  - `const THEME_STORAGE_KEY = "theme"`
  - `function resolveStoredTheme(raw: string | null): Theme | null` — returns `"light"`/`"dark"` for valid input, else `null`.
  - `function oppositeTheme(t: Theme): Theme`
  - `const THEME_INIT_SCRIPT: string` — self-invoking JS (as a string) that reads `localStorage[THEME_STORAGE_KEY]` and, if valid, sets `document.documentElement.dataset.theme`. Wrapped in try/catch. No stored value ⇒ no attribute ⇒ light defaults apply.

- [ ] **Step 1: Write the failing test**

Create `tests/theme.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  THEME_STORAGE_KEY,
  resolveStoredTheme,
  oppositeTheme,
  THEME_INIT_SCRIPT,
} from "../lib/theme";

test("storage key is 'theme'", () => {
  assert.equal(THEME_STORAGE_KEY, "theme");
});

test("resolveStoredTheme accepts valid values", () => {
  assert.equal(resolveStoredTheme("light"), "light");
  assert.equal(resolveStoredTheme("dark"), "dark");
});

test("resolveStoredTheme rejects anything else as null", () => {
  assert.equal(resolveStoredTheme(null), null);
  assert.equal(resolveStoredTheme(""), null);
  assert.equal(resolveStoredTheme("DARK"), null);
  assert.equal(resolveStoredTheme("system"), null);
});

test("oppositeTheme flips", () => {
  assert.equal(oppositeTheme("light"), "dark");
  assert.equal(oppositeTheme("dark"), "light");
});

test("init script references the storage key and sets data-theme", () => {
  assert.match(THEME_INIT_SCRIPT, /localStorage/);
  assert.match(THEME_INIT_SCRIPT, /theme/);
  assert.match(THEME_INIT_SCRIPT, /dataset\.theme|data-theme/);
  // must be self-contained (no imports) and defensive
  assert.match(THEME_INIT_SCRIPT, /try/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../lib/theme`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/theme.ts`:

```ts
/** Light/dark theme identity + pre-paint bootstrap. Pure — no React, no DOM at import time. */

export type Theme = "light" | "dark";

/** localStorage key holding the user's explicit choice. */
export const THEME_STORAGE_KEY = "theme";

/** Narrow an arbitrary stored string to a valid Theme, or null. */
export function resolveStoredTheme(raw: string | null): Theme | null {
  return raw === "light" || raw === "dark" ? raw : null;
}

/** The other theme. */
export function oppositeTheme(t: Theme): Theme {
  return t === "dark" ? "light" : "dark";
}

/**
 * Synchronous script injected into <head> so it runs before first paint.
 * Reads the stored choice and sets data-theme on <html>. No stored value
 * leaves the attribute unset, so the :root (light) defaults apply.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all theme tests green; existing suites still pass).

- [ ] **Step 5: Commit**

```bash
git add lib/theme.ts tests/theme.test.ts
git commit -m "feat: pure theme helpers (types, storage, init script)"
```

---

## Task 2: Split palette into light default + dark override (`app/globals.css`)

**Files:**
- Modify: `app/globals.css:3-72` (the `@theme` block) and the `body` rule.

**Interfaces:**
- Produces: every `--color-*` token resolves to `var(--<name>)`; `--<name>` values differ by `:root` (light) vs `:root[data-theme="dark"]` (dark). Shadows `--shadow-card/-raise/-pr` likewise theme-scoped. No token names change, so all existing utilities keep working.

This task is CSS-only; verification is via the dev server (no unit test).

- [ ] **Step 1: Rewrite the color/shadow section of `@theme` to use indirection**

In `app/globals.css`, replace the color tokens and shadow tokens **inside `@theme { … }`** (lines ~4–63) so each points at a plain variable. Keep fonts, radius, and spacing exactly as they are. The color/shadow portion of `@theme` becomes:

```css
@theme {
  /* ---- Colors: values live in :root / [data-theme="dark"] below ---- */
  --color-bg:        var(--bg);
  --color-bg-subtle: var(--bg-subtle);
  --color-surface:   var(--surface);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);

  --color-border:        var(--border);
  --color-border-strong: var(--border-strong);
  --color-border-faint:  var(--border-faint);

  --color-text:       var(--text);
  --color-text-2:     var(--text-2);
  --color-text-3:     var(--text-3);
  --color-text-faint: var(--text-faint);

  --color-accent:        var(--accent);
  --color-accent-hover:  var(--accent-hover);
  --color-accent-press:  var(--accent-press);
  --color-accent-text:   var(--accent-text);
  --color-accent-muted:  var(--accent-muted);
  --color-accent-border: var(--accent-border);

  --color-success:       var(--success);
  --color-success-muted: var(--success-muted);
  --color-warning:       var(--warning);
  --color-warning-muted: var(--warning-muted);
  --color-danger:        var(--danger);
  --color-danger-muted:  var(--danger-muted);
  --color-info:          var(--info);
  --color-info-muted:    var(--info-muted);

  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-chart-6: var(--chart-6);

  --shadow-card:  var(--shadow-card-v);
  --shadow-raise: var(--shadow-raise-v);
  --shadow-pr:    var(--shadow-pr-v);

  /* fonts, radius, spacing: UNCHANGED — keep existing declarations here */
}
```

Keep the existing `--font-*`, `--radius-*`, and spacing comment block inside `@theme` untouched.

- [ ] **Step 2: Add the light (`:root`) and dark (`[data-theme="dark"]`) value blocks**

Immediately **after** the closing `}` of `@theme`, add:

```css
/* ---- Light theme (default) ---- */
:root {
  --bg:        #F7F8FA;
  --bg-subtle: #F1F3F5;
  --surface:   #FFFFFF;
  --surface-2: #F7F8FA;
  --surface-3: #EDEFF2;

  --border:        #E3E6EA;
  --border-strong: #CDD2D8;
  --border-faint:  #EDEFF2;

  --text:       #16181C;
  --text-2:     #4A5158;
  --text-3:     #767D86;
  --text-faint: #A3AAB2;

  --accent:        #4F46E5;
  --accent-hover:  #4338CA;
  --accent-press:  #3730A3;
  --accent-text:   #FFFFFF;
  --accent-muted:  #4F46E514;
  --accent-border: #4F46E540;

  --success:       #16A34A;
  --success-muted: #DCFCE7;
  --warning:       #D97706;
  --warning-muted: #FEF3C7;
  --danger:        #DC2626;
  --danger-muted:  #FEE2E2;
  --info:          #2563EB;
  --info-muted:    #DBEAFE;

  --chart-1: #4F46E5;
  --chart-2: #0EA5E9;
  --chart-3: #DB2777;
  --chart-4: #D97706;
  --chart-5: #7C3AED;
  --chart-6: #0D9488;

  --shadow-card-v:  0 1px 2px 0 rgb(16 24 40 / 0.06), 0 1px 3px 0 rgb(16 24 40 / 0.04);
  --shadow-raise-v: 0 8px 24px -8px rgb(16 24 40 / 0.16);
  --shadow-pr-v:    0 0 0 1px #4F46E540, 0 0 24px -4px #4F46E559;
}

/* ---- Dark theme (opt-in via toggle) — values moved verbatim from the old @theme ---- */
:root[data-theme="dark"] {
  --bg:        #0A0B0D;
  --bg-subtle: #101114;
  --surface:   #16181C;
  --surface-2: #1D2025;
  --surface-3: #24282E;

  --border:        #24272D;
  --border-strong: #33373F;
  --border-faint:  #1A1C20;

  --text:       #F2F4F5;
  --text-2:     #A8AFB8;
  --text-3:     #666D78;
  --text-faint: #43484F;

  --accent:        #A3E635;
  --accent-hover:  #B5F04D;
  --accent-press:  #8FCF2B;
  --accent-text:   #0A0B0D;
  --accent-muted:  #A3E63514;
  --accent-border: #A3E63540;

  --success:       #4ADE80;
  --success-muted: #4ADE8014;
  --warning:       #FBBF24;
  --warning-muted: #FBBF2414;
  --danger:        #F87171;
  --danger-muted:  #F8717114;
  --info:          #38BDF8;
  --info-muted:    #38BDF814;

  --chart-1: #A3E635;
  --chart-2: #38BDF8;
  --chart-3: #F472B6;
  --chart-4: #FBBF24;
  --chart-5: #818CF8;
  --chart-6: #2DD4BF;

  --shadow-card-v:  0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 1px 2px 0 rgb(0 0 0 / 0.4);
  --shadow-raise-v: 0 1px 0 0 rgb(255 255 255 / 0.05) inset, 0 8px 24px -8px rgb(0 0 0 / 0.6);
  --shadow-pr-v:    0 0 0 1px #A3E63540, 0 0 24px -4px #A3E63559;
}
```

Leave the `body { @apply bg-bg text-text-2 antialiased; }` rule unchanged.

- [ ] **Step 3: Verify dark still renders and light is the default**

Run: `npm run dev`, open the app.
Expected: default (no `localStorage.theme`) is **light** — off-white bg `#F7F8FA`, white cards, dark text, indigo accents/active nav. Then in DevTools console run `document.documentElement.dataset.theme = "dark"` — the UI returns to the **original dark look** (matches today). Remove it (`delete document.documentElement.dataset.theme`) → back to light.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat: light default palette + dark override via data-theme"
```

---

## Task 3: Theme provider + `useTheme` hook (`components/theme/ThemeProvider.tsx`)

**Files:**
- Create: `components/theme/ThemeProvider.tsx`

**Interfaces:**
- Consumes: `Theme`, `THEME_STORAGE_KEY`, `resolveStoredTheme`, `oppositeTheme` from `@/lib/theme`.
- Produces:
  - `default export function ThemeProvider({ children }: { children: React.ReactNode })`
  - `function useTheme(): { theme: Theme; toggle(): void; setTheme(t: Theme): void }`

- [ ] **Step 1: Write the provider + hook**

Create `components/theme/ThemeProvider.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  THEME_STORAGE_KEY,
  oppositeTheme,
  resolveStoredTheme,
  type Theme,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Reads the current theme from the DOM/storage — matches the pre-paint script. */
function readCurrentTheme(): Theme {
  if (typeof document !== "undefined") {
    const attr = resolveStoredTheme(document.documentElement.dataset.theme ?? null);
    if (attr) return attr;
  }
  if (typeof localStorage !== "undefined") {
    const stored = resolveStoredTheme(localStorage.getItem(THEME_STORAGE_KEY));
    if (stored) return stored;
  }
  return "light";
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR renders "light" (the default); the effect syncs to the real value on mount.
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    setThemeState(readCurrentTheme());
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(oppositeTheme(readCurrentTheme()));
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
```

- [ ] **Step 2: Verify it typechecks / builds**

Run: `npx tsc --noEmit`
Expected: no errors from `components/theme/ThemeProvider.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/theme/ThemeProvider.tsx
git commit -m "feat: ThemeProvider + useTheme hook"
```

---

## Task 4: Wire layout — pre-paint script + provider (`app/layout.tsx`)

**Files:**
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `THEME_INIT_SCRIPT` from `@/lib/theme`, `ThemeProvider` from `@/components/theme/ThemeProvider`.

- [ ] **Step 1: Add imports, the pre-paint script, and wrap with ThemeProvider**

Edit `app/layout.tsx`. Add imports near the top:

```tsx
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import ThemeProvider from "@/components/theme/ThemeProvider";
```

Change the `<html>` tag to add `suppressHydrationWarning` (the init script mutates it before hydration) and add a `<head>` containing the script; wrap the body's content in `ThemeProvider`. The returned JSX becomes:

```tsx
  return (
    <html
      lang="en"
      className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh font-sans">
        <ThemeProvider>
          {user ? (
            <>
              <Sidebar username={user.displayUsername ?? user.username ?? user.name} />
              <main className="lg:pl-60">
                <div className="mx-auto max-w-[110rem] px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-8">
                  {children}
                </div>
              </main>
              <MobileNav />
            </>
          ) : (
            children
          )}
        </ThemeProvider>
      </body>
    </html>
  );
```

- [ ] **Step 2: Verify no-flash + provider active**

Run: `npm run dev`. In the browser: set `localStorage.theme = "dark"` and reload — the page paints **dark immediately** with no light flash. Set `localStorage.theme = "light"` (or `localStorage.removeItem("theme")`) and reload — paints light with no flash.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: pre-paint theme script + ThemeProvider in root layout"
```

---

## Task 5: Theme toggle control + placement (`components/theme/ThemeToggle.tsx`, Sidebar, MobileNav)

**Files:**
- Create: `components/theme/ThemeToggle.tsx`
- Modify: `components/layout/Sidebar.tsx` (footer, `space-y-2 p-3 border-t` block, ~lines 46-70)
- Modify: `components/layout/MobileNav.tsx` ("More" sheet, near its Sign-out action)

**Interfaces:**
- Consumes: `useTheme` from `@/components/theme/ThemeProvider`.
- Produces: `default export function ThemeToggle({ className }: { className?: string })`.

- [ ] **Step 1: Write the toggle component**

Create `components/theme/ThemeToggle.tsx`:

```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

const RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`inline-flex items-center gap-2 text-xs text-text-3 hover:text-text-2 transition-colors ${RING} ${className}`}
    >
      {isDark ? <Sun className="size-4" strokeWidth={2} /> : <Moon className="size-4" strokeWidth={2} />}
      <span>{isDark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
```

- [ ] **Step 2: Place it in the desktop sidebar footer**

In `components/layout/Sidebar.tsx`, add the import after the existing imports:

```tsx
import ThemeToggle from "@/components/theme/ThemeToggle";
```

Then in the footer `<div className="space-y-2 p-3 border-t border-border-faint">`, add a row above the username row:

```tsx
        <div className="flex items-center justify-between rounded-sm px-3 py-1.5">
          <ThemeToggle />
        </div>
```

(Place it as the first child inside that footer `div`, before the `Block · Week` chip, or between the chip and the username row — either reads fine; keep it inside the same footer block.)

- [ ] **Step 3: Place it in the mobile "More" sheet**

In `components/layout/MobileNav.tsx`, add the import:

```tsx
import ThemeToggle from "@/components/theme/ThemeToggle";
```

Locate the Sign-out action inside the "More" sheet (the `<LogOut …>` control) and render `<ThemeToggle />` in the same action area, e.g. directly above the Sign-out button:

```tsx
        <div className="px-3 py-2">
          <ThemeToggle />
        </div>
```

- [ ] **Step 4: Verify toggling works and persists in both places**

Run: `npm run dev`. Desktop: click the sidebar toggle → theme flips instantly (icon/label update), reload → choice persists. Shrink to mobile width: open "More" → toggle present and works.

- [ ] **Step 5: Commit**

```bash
git add components/theme/ThemeToggle.tsx components/layout/Sidebar.tsx components/layout/MobileNav.tsx
git commit -m "feat: theme toggle in sidebar footer and mobile More sheet"
```

---

## Task 6: Runtime-resolved chart theme (`components/charts/ChartTheme.tsx`)

**Files:**
- Modify: `components/charts/ChartTheme.tsx`

**Interfaces:**
- Consumes: `useTheme` from `@/components/theme/ThemeProvider`.
- Produces a new hook and keeps color-free exports:
  - `useChartTheme(): ChartTheme` where
    ```ts
    interface ChartTheme {
      colors: { volt: string; sky: string; pink: string; amber: string; indigo: string; teal: string };
      series: string[];            // Object.values(colors)
      bg: string;                  // --bg (dot cutouts, activeDot stroke)
      gridProps: { stroke: string; strokeDasharray: string; vertical: boolean };
      axisProps: { axisLine: false; tickLine: false; tick: { fill: string; fontSize: number } };
      yAxisProps: { /* axisProps + tickCount, domain */ };
      tooltipCursor: { stroke: string };
      prDotProps: { r: number; fill: string; stroke: string };
      targetLineProps: { stroke: string; strokeDasharray: string };
      axisText: string;            // --text-3 (labels, muted fills)
      faint: string;               // --text-faint (muted dots)
      surface2: string;            // --surface-2 (bar cursor fill)
      lineProps: (color: string) => object;
      barProps: (color: string) => object;
    }
    ```
  - Keeps existing color-free exports unchanged: `CHART_MARGIN`, `BAR_CATEGORY_GAP`, `AREA_GRADIENT_STOPS`, `ChartTooltip`.
- Note: the old color-bearing consts (`CHART_COLORS`, `CHART_SERIES`, `CHART_BG`, `GRID_PROPS`, `AXIS_PROPS`, `Y_AXIS_PROPS`, `TOOLTIP_CURSOR`, `PR_DOT_PROPS`, `TARGET_LINE_PROPS`, `lineProps`, `barProps`) are **removed** and replaced by the hook — all consumers migrate in Task 7 (same PR).

- [ ] **Step 1: Add a resolver + hook to ChartTheme.tsx**

At the top of `components/charts/ChartTheme.tsx`, add imports:

```tsx
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
```

Add a pure resolver and the hook. `readVar` pulls a resolved color off `<html>`; a fallback map keeps charts sane during SSR / first paint (light defaults, matching `:root`):

```tsx
const LIGHT_FALLBACK: Record<string, string> = {
  "--chart-1": "#4F46E5", "--chart-2": "#0EA5E9", "--chart-3": "#DB2777",
  "--chart-4": "#D97706", "--chart-5": "#7C3AED", "--chart-6": "#0D9488",
  "--bg": "#F7F8FA", "--text-3": "#767D86", "--text-faint": "#A3AAB2",
  "--surface-2": "#F7F8FA", "--border": "#E3E6EA", "--border-strong": "#CDD2D8",
};

function readVar(name: string): string {
  if (typeof window === "undefined") return LIGHT_FALLBACK[name] ?? "#000";
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || LIGHT_FALLBACK[name] || "#000";
}

function buildChartTheme() {
  const colors = {
    volt: readVar("--chart-1"),
    sky: readVar("--chart-2"),
    pink: readVar("--chart-3"),
    amber: readVar("--chart-4"),
    indigo: readVar("--chart-5"),
    teal: readVar("--chart-6"),
  };
  const bg = readVar("--bg");
  const axisText = readVar("--text-3");
  const faint = readVar("--text-faint");
  const surface2 = readVar("--surface-2");
  const grid = readVar("--border");
  const borderStrong = readVar("--border-strong");

  const axisProps = {
    axisLine: false as const,
    tickLine: false as const,
    tick: { fill: axisText, fontSize: 11 },
  };

  return {
    colors,
    series: Object.values(colors),
    bg,
    axisText,
    faint,
    surface2,
    gridProps: { stroke: grid, strokeDasharray: "3 6", vertical: false as const },
    axisProps,
    yAxisProps: { ...axisProps, tickCount: 4, domain: ["auto", "auto"] as [string, string] },
    tooltipCursor: { stroke: borderStrong },
    prDotProps: { r: 3.5, fill: colors.volt, stroke: bg },
    targetLineProps: { stroke: axisText, strokeDasharray: "4 4" },
    lineProps: (color: string) => ({
      stroke: color,
      strokeWidth: 2,
      dot: false,
      activeDot: { r: 4, fill: color, stroke: bg, strokeWidth: 2 },
      type: "monotone" as const,
    }),
    barProps: (color: string) => ({
      fill: color,
      radius: [4, 4, 0, 0] as [number, number, number, number],
    }),
  };
}

export type ChartTheme = ReturnType<typeof buildChartTheme>;

/** Resolved chart colors for the active theme; recomputes on toggle. */
export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();
  const [ct, setCt] = useState<ChartTheme>(() => buildChartTheme());
  useEffect(() => {
    setCt(buildChartTheme());
  }, [theme]);
  return ct;
}
```

- [ ] **Step 2: Remove the superseded color-bearing consts**

Delete these now-replaced exports from `ChartTheme.tsx`: `CHART_COLORS`, `CHART_SERIES`, `CHART_BG`, `GRID_PROPS`, `AXIS_PROPS`, `Y_AXIS_PROPS`, `TOOLTIP_CURSOR`, `PR_DOT_PROPS`, `TARGET_LINE_PROPS`, and the standalone `lineProps`/`barProps` functions. **Keep** `CHART_MARGIN`, `BAR_CATEGORY_GAP`, `AREA_GRADIENT_STOPS`, and `ChartTooltip` (the tooltip already uses CSS-class colors, so it's theme-aware as-is).

- [ ] **Step 3: Verify (build will fail in consumers — expected until Task 7)**

Run: `npx tsc --noEmit`
Expected: errors ONLY in the 13 consumer files / `app/analytics/page.tsx` referencing the removed consts. `ChartTheme.tsx` itself has no errors. (Do not commit yet — Task 7 restores a green build in the same commit.)

- [ ] **Step 4: Stage (defer commit to Task 7)**

Do not commit standalone; Tasks 6 and 7 land together so the tree always builds. Proceed to Task 7.

---

## Task 7: Migrate chart consumers to `useChartTheme()` + fix scattered literals

**Files (modify):**
- `components/recovery/RecoveryTrendChart.tsx`
- `components/dashboard/DashboardCharts.tsx`
- `components/exercises/ExerciseProgressChart.tsx`
- `components/nutrition/NutritionTrendChart.tsx`
- `components/measurements/MetricCardGrid.tsx`
- `components/analytics/WhoopStrainChart.tsx`
- `components/analytics/WeeklyMuscleVolumeChart.tsx`
- `components/analytics/E1rmChart.tsx`
- `components/analytics/WhoopSleepChart.tsx`
- `components/analytics/RecoveryPerformanceChart.tsx`
- `components/analytics/AvgRirChart.tsx`
- `components/analytics/WhoopRecoveryChart.tsx`
- `components/analytics/BodyWeightChart.tsx`
- `app/analytics/page.tsx`

**Interfaces:**
- Consumes: `useChartTheme` from `@/components/charts/ChartTheme` (plus the retained color-free consts).

**The canonical per-file transform.** Each chart component is a `"use client"` component. For each file:

1. In the `ChartTheme` import, **remove** the color-bearing names (`CHART_COLORS`, `CHART_SERIES`, `CHART_BG`, `GRID_PROPS`, `AXIS_PROPS`, `Y_AXIS_PROPS`, `TOOLTIP_CURSOR`, `PR_DOT_PROPS`, `TARGET_LINE_PROPS`, `lineProps`, `barProps`) and **add** `useChartTheme`. Keep any of `CHART_MARGIN`, `BAR_CATEGORY_GAP`, `AREA_GRADIENT_STOPS`, `ChartTooltip` the file already imports.
2. At the **top of the component function body**, add: `const ct = useChartTheme();`
3. Replace usages by name:
   - `CHART_COLORS` → `ct.colors`
   - `CHART_SERIES` → `ct.series`
   - `CHART_BG` → `ct.bg`
   - `GRID_PROPS` → `ct.gridProps`
   - `AXIS_PROPS` → `ct.axisProps`
   - `Y_AXIS_PROPS` → `ct.yAxisProps`
   - `TOOLTIP_CURSOR` → `ct.tooltipCursor`
   - `PR_DOT_PROPS` → `ct.prDotProps`
   - `TARGET_LINE_PROPS` → `ct.targetLineProps`
   - `lineProps(x)` → `ct.lineProps(x)`
   - `barProps(x)` → `ct.barProps(x)`

Then apply the file-specific literal fixes below. Worked example first:

**Worked example — `components/analytics/RecoveryPerformanceChart.tsx`:**
- Import: drop `AXIS_PROPS, CHART_COLORS, GRID_PROPS, barProps` (and `TOOLTIP_CURSOR` if present) from the ChartTheme import; add `useChartTheme`; keep `BAR_CATEGORY_GAP, ChartTooltip, CHART_MARGIN` as present.
- Add `const ct = useChartTheme();` at the top of the component.
- Replace `AXIS_PROPS`→`ct.axisProps`, `GRID_PROPS`→`ct.gridProps`, `barProps(CHART_COLORS.volt)`→`ct.barProps(ct.colors.volt)`.
- Fix literal at line 54: `cursor={{ fill: "#1D2025", opacity: 0.5 }}` → `cursor={{ fill: ct.surface2, opacity: 0.5 }}`.

**Worked example — `components/analytics/BodyWeightChart.tsx`:**
- Import: drop `AXIS_PROPS, CHART_COLORS, GRID_PROPS, lineProps, TOOLTIP_CURSOR, Y_AXIS_PROPS`; add `useChartTheme`; keep `CHART_MARGIN, ChartTooltip`.
- Add `const ct = useChartTheme();`.
- Apply the name replacements above.
- Fix literals at lines 47-48: `dot={{ r: 2.5, fill: "#43484F", strokeWidth: 0 }}` → `dot={{ r: 2.5, fill: ct.faint, strokeWidth: 0 }}`, and `activeDot={{ r: 4, fill: "#43484F", stroke: "#0A0B0D", strokeWidth: 2 }}` → `activeDot={{ r: 4, fill: ct.faint, stroke: ct.bg, strokeWidth: 2 }}`.

**Remaining files — apply the canonical transform, plus these literal fixes:**

- [ ] `components/recovery/RecoveryTrendChart.tsx` — transform only (uses `AXIS_PROPS, CHART_COLORS, CHART_MARGIN, ChartTooltip, GRID_PROPS, lineProps, TARGET_LINE_PROPS, TOOLTIP_CURSOR`). No raw literals.
- [ ] `components/dashboard/DashboardCharts.tsx` — transform only (`AREA_GRADIENT_STOPS, AXIS_PROPS, BAR_CATEGORY_GAP, CHART_COLORS, CHART_MARGIN, ChartTooltip, GRID_PROPS, lineProps, barProps, TARGET_LINE_PROPS, TOOLTIP_CURSOR, Y_AXIS_PROPS`). No raw literals.
- [ ] `components/exercises/ExerciseProgressChart.tsx` — transform only. No raw literals.
- [ ] `components/nutrition/NutritionTrendChart.tsx` — transform only. No raw literals.
- [ ] `components/measurements/MetricCardGrid.tsx` — transform (`AREA_GRADIENT_STOPS, CHART_COLORS, ChartTooltip, TOOLTIP_CURSOR`). Fix line 90: `activeDot={{ r: 4, fill: color, stroke: "#0A0B0D", strokeWidth: 2 }}` → `stroke: ct.bg`.
- [ ] `components/analytics/WhoopStrainChart.tsx` — transform only. No raw literals.
- [ ] `components/analytics/WeeklyMuscleVolumeChart.tsx` — transform (`AXIS_PROPS, BAR_CATEGORY_GAP, CHART_COLORS, CHART_MARGIN, ChartTooltip, GRID_PROPS, TARGET_LINE_PROPS, Y_AXIS_PROPS`). Note it also uses a local `REGION_COLORS` map keyed off `CHART_COLORS.*` — repoint those entries to `ct.colors.*` (move the map construction inside the component after `const ct = useChartTheme()`, or derive fills inline). Fix line 56 `cursor={{ fill: "#1D2025", opacity: 0.5 }}` → `ct.surface2`; line 70 label `fill: "#666D78"` → `ct.axisText`.
- [ ] `components/analytics/E1rmChart.tsx` — transform (`AREA_GRADIENT_STOPS, AXIS_PROPS, CHART_COLORS, CHART_MARGIN, GRID_PROPS, PR_DOT_PROPS, TOOLTIP_CURSOR, Y_AXIS_PROPS`). Fix line 78: `activeDot={{ r: 4, fill: color, stroke: "#0A0B0D", strokeWidth: 2 }}` → `stroke: ct.bg`.
- [ ] `components/analytics/WhoopSleepChart.tsx` — transform (`AXIS_PROPS, BAR_CATEGORY_GAP, barProps, CHART_COLORS, CHART_MARGIN, ChartTooltip, GRID_PROPS, lineProps`). Fix line 56 `cursor={{ fill: "#1D2025", opacity: 0.5 }}` → `ct.surface2`.
- [ ] `components/analytics/AvgRirChart.tsx` — transform only. No raw literals.
- [ ] `components/analytics/WhoopRecoveryChart.tsx` — transform only. No raw literals.
- [ ] `app/analytics/page.tsx` — this is a **server component**; it defines `const BIG_FOUR_COLORS = ["#A3E635", "#F472B6", "#FBBF24", "#818CF8"]` (line 26) and passes colors to a client chart. Do **not** call the hook here. Instead pass semantic identity down and resolve in the client child, OR replace the hardcoded array with the CSS-var references already used elsewhere in this file (`VOLUME_LEGEND` uses `colorVar: "--color-chart-N"`). Change `BIG_FOUR_COLORS` to `["--color-chart-1", "--color-chart-3", "--color-chart-4", "--color-chart-5"]` and have the consuming client chart resolve them via `ct.colors`/`readVar`, matching the `colorVar` pattern already in this file. Verify which client component receives `BIG_FOUR_COLORS` and resolve there.

- [ ] **Step (per file): after each file, typecheck**

Run: `npx tsc --noEmit`
Expected: error count drops as each file is migrated; zero errors once all 14 are done.

- [ ] **Final Step: full verify + commit (Tasks 6 + 7 together)**

Run: `npx tsc --noEmit` (expect clean) and `npm test` (expect all suites pass).
Then `npm run dev` and open **every** analytics/dashboard/recovery/exercise/nutrition/measurement chart in **light** mode — confirm gridlines, axis labels, series, cursors, tooltips, PR dots, and target lines are all legible on light. Toggle to **dark** — confirm each chart matches today's dark appearance.

```bash
git add components/charts/ChartTheme.tsx components/recovery/RecoveryTrendChart.tsx \
  components/dashboard/DashboardCharts.tsx components/exercises/ExerciseProgressChart.tsx \
  components/nutrition/NutritionTrendChart.tsx components/measurements/MetricCardGrid.tsx \
  components/analytics/WhoopStrainChart.tsx components/analytics/WeeklyMuscleVolumeChart.tsx \
  components/analytics/E1rmChart.tsx components/analytics/WhoopSleepChart.tsx \
  components/analytics/RecoveryPerformanceChart.tsx components/analytics/AvgRirChart.tsx \
  components/analytics/WhoopRecoveryChart.tsx components/analytics/BodyWeightChart.tsx \
  app/analytics/page.tsx
git commit -m "feat: theme-aware chart colors via useChartTheme; charts adapt to light/dark"
```

---

## Final verification (whole feature)

- [ ] `npm test` — all suites pass (including `tests/theme.test.ts`).
- [ ] `npx tsc --noEmit` — no type errors.
- [ ] Fresh load with no `localStorage.theme` → **light** default, no flash.
- [ ] Load with `localStorage.theme = "dark"` → **dark** immediately, no flash; matches today's dark UI.
- [ ] Toggle (sidebar + mobile "More") flips instantly and persists across reload.
- [ ] All charts legible in both themes.
- [ ] Contrast spot-check: accent buttons/text, status colors, and body text pass WCAG AA on light.

## Notes / risk areas

- **Recharts + `var()` won't work** — that's why colors are resolved to literal hex via `getComputedStyle`. Don't try to pass `var(--chart-1)` into SVG attributes.
- **First-paint chart color:** `useChartTheme` seeds from `buildChartTheme()` which uses `LIGHT_FALLBACK` during SSR; the `useEffect` re-reads real computed values on mount and on every theme change. Since light is the default, the fallback matches the common case.
- **`app/analytics/page.tsx` is a server component** — resolve `BIG_FOUR_COLORS` in the client child, not via the hook in the page.
- **`WeeklyMuscleVolumeChart` `REGION_COLORS`** must be rebuilt from `ct.colors` inside the component (it currently closes over the removed `CHART_COLORS`).
