# Plan: Six-Theme System for shadcn-based App (Preserve Default + 5 New Palettes)

**Status:** Plan — do not implement yet.
**Date:** 2026-08-27
**Scope:** `frontend/` only (Vite + React 19 + Tailwind v4 + shadcn/ui). No backend changes.
**Constraint:** Keep current default theme **byte-for-byte** identical. All new palettes must be CSS custom-property driven, shadcn-consistent, distinct/cohesive/accessible, with strong readability. Image `image.png` is inspiration for the *selection concept* only — not colors.

---

## 1. Goals & Non-Goals

### Goals
- Ship **6 total themes**: `default` (existing, untouched) + 5 new distinct themes, each with **light + dark** value sets.
- Keep CSS custom-property structure clean, shadcn-conventional (semantic tokens → Tailwind utilities → components), and avoid hardcoded component colors.
- Provide an accessible, polished theme picker inspired by the attached image’s *layout* (color-scheme row + theme grid with live previews), not its colors.
- Support light / dark / system color-scheme behavior orthogonally to palette choice, with correct persistence and no FOUC.

### Non-Goals
- No backend persistence of theme preference (local-first; backend endpoint can be a follow-up).
- No user-generated “Create theme / Import theme” (image shows those buttons — out of scope unless ticketed separately).
- No radius/typography redesign — tokens ` --radius`, `--font-*` stay shared.
- No inline `oklch()/hex` in `.tsx` files — all color lives in CSS.

---

## 2. Current State Inventory (Verified)

### 2.1 Files
- `frontend/src/globals.css:1-18` — Tailwind v4 imports (`@import "tailwindcss"`, `@import "shadcn/tailwind.css"`), splits app tokens into `styles/tokens.css`, `styles/base.css`, etc.
- `frontend/src/globals.css:19` — `@custom-variant dark (&:is(.dark *));` → dark mode is **class-based** on an ancestor (currently `<html class="dark">` injected by `next-themes`).
- `frontend/src/globals.css:20-92` — `@theme inline` maps semantic tokens (`--background`, `--foreground`, `--primary`, `--sidebar-*`, `--chart-*`, `--surface-*`, `--text-*`, `--composer-*`, etc.) to Tailwind utilities (`bg-surface-1`, `text-text-faint`, …).
- `frontend/src/globals.css:94-164` — `:root` (light) and `.dark` (dark) define **core shadcn tokens** exclusively (comment at line 94 says “keep only core design tokens in this file”). Light/dark values are `oklch(...)`, light is neutral/gray (≈ 0 chroma), dark is near-black/near-white ladder.
- `frontend/src/styles/tokens.css:1-138` — **app-specific extended tokens**: ease, layers, brand (unused, gray), fonts, type scale, popover-hover/selected, panel-bg/header, studio-resource, composer translucent glass, semantic `success/warning/info`, CTA gradient, **surface ladder 0-4 + borders + text-primary/secondary/tertiary/faint**. Mirrors `:root` / `.dark` split. `roadmap-theme.css:1-47` correctly references ladder via `var(--surface-*)` — pattern to copy.
- `frontend/src/styles/base.css`, `utilities.css`, `components.css`, `overrides.css`, `motion.css` — no color definitions except `overrides.css:5-37` dark dialog tweaks (`--card`, `--muted`, etc. scoped to `[data-slot="dialog-content"]`). Important: any global theme must not break those scopes.
- `frontend/components.json:1-25` — `style: base-rhea`, `baseColor: neutral`, `cssVariables: true`, `iconLibrary: lucide`. Tailwind v4 (“`tailwind.config` is empty” → config via CSS).
- `frontend/src/app/providers/index.tsx:76` — `ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange` (`next-themes@0.4.6`). Keyboard `d` toggles `resolvedTheme`.
- `frontend/src/pages/settings/ui/settings-page.tsx:386-490` — current `Appearance` is a small segmented control (Light / Dark / System) inside a card, using `useTheme()` from `next-themes`. This is the anchor for the new picker.
- `frontend/index.html:2-18` — no inline theme script; relies on `next-themes` hydration (has FOUC risk if extended).
- `frontend/src/shared/ui/*.tsx` — all color usage is semantic (`bg-card`, `bg-muted`, `bg-surface-*`, `text-muted-foreground`, `border-border`, etc.). Only hard-coded outlier found:
  - `settings-page.tsx:91` `text-[#171717]` for Kimi icon — must be replaced with semantic or tokenized value as part of this work (lint gate).
  - `button.tsx:15` legitimate `color-mix(in oklch, …)` on semantic var — acceptable.
  - Shimmer/quiz/overlay utilities use white/black opacity for glass effects — intentional, not palette.

### 2.2 Conventions to Preserve
- **Neutral surface ladder** (`color-hierarchy` skill): `surface-0` (page) → `surface-1` (card) → `surface-2` (row on card) → `surface-3` (selected) → `surface-4` (pressed). Borders step with it. Text uses `text-primary/secondary/tertiary/faint`. No opacity-driven hierarchy, no `muted` remixes for grays.
- **Token layering**: `globals.css` for core shadcn tokens (+ `@theme inline`), `tokens.css` for app extensions. **Do not** scatter color definitions into new CSS files arbitrarily; keep the import order stable.
- **Shadcn guardrail**: color variables added in the file at `tailwind.cssFile` (`globals.css`) and registered in `@theme inline`. Check `npx shadcn@latest info` before adding new utilities; never create a second Tailwind config.
- **FSD**: `app/` providers, `pages/settings` page, `features/` slices, `shared/ui` kit. Theme logic is cross-cutting → lives in `features/theme` (logic + UI) and `app/providers` (composition). Keep `shared/ui` free of business state.

---

## 3. Target Architecture

### 3.1 Palette × Mode Matrix

```
                  Mode (next-themes, class on <html>)
                  ┌─────────┬─────────┬─────────┐
                  │  light  │  dark   │ system* │
        ┌─────────┼─────────┼─────────┼─────────┤
 Palette │ default │ ✓ (:root) │ ✓ (.dark) │  ↕   │
(data-   ├─────────┼─────────┼─────────┼─────────┤
 theme   │ dune    │ ✓       │ ✓       │  ↕   │
  on     │ grove   │ ✓       │ ✓       │  ↕   │
 <html>) │ tide    │ ✓       │ ✓       │  ↕   │
         │ ember   │ ✓       │ ✓       │  ↕   │
         │ plum    │ ✓       │ ✓       │  ↕   │
         └─────────┴─────────┴─────────┴─────────┘
         * system resolves to light/dark via prefers-color-scheme
```

- **Palette** = chromatic identity + semantic token values. Set via **`data-theme` attribute on `<html>`** (`default` | `dune` | `grove` | `tide` | `ember` | `plum`). Names are proposals; final names ticketed in §5.
- **Mode** = light/dark/system. Set via **`class="dark"` on `<html>`** (existing `next-themes` behavior, unchanged).
- CSS selectors: `:root` and `.dark` remain the **default** palette. Every other palette overrides with higher-specificity attribute selectors, preserving cascade:

```css
:root { /* default light — current values, untouched */ }
.dark { /* default dark — current values, untouched */ }

/* Example: new palette “grove” */
html[data-theme="grove"] { /* light overrides */ }
html.dark[data-theme="grove"] { /* dark overrides */ }
/* Alternative equivalently-specific form: [data-theme="grove"].dark — pick one and be consistent */
```

This keeps `@custom-variant dark (&:is(.dark *))` working without change — all components using `dark:` utilities and semantic vars continue to work.

### 3.2 Token Coverage Per Theme

Every theme (light + dark) must define the **full semantic surface**, not just `primary`:

| Bucket | Tokens (CSS vars) |
|--------|--------------------|
| Core shadcn | `--background / --foreground`, `--card / --card-foreground`, `--popover / --popover-foreground / --popover-hover / --popover-selected`, `--primary / --primary-foreground`, `--secondary / --secondary-foreground`, `--muted / --muted-foreground`, `--accent / --accent-foreground`, `--destructive / --destructive-foreground`, `--border`, `--input`, `--ring`, `--chart-1..5`, `--radius` (shared, not per-theme), `--sidebar-*` (6 vars) |
| App extensions (`tokens.css`) | `--surface-0..4`, `--surface-border-subtle / --surface-border / --surface-border-strong`, `--text-primary / --text-secondary / --text-tertiary / --text-faint`, `--panel-bg / --panel-header-bg / --study-materials-panel`, `--studio-resource / --studio-resource-hover / --studio-resource-foreground / --studio-resource-icon`, `--composer-*` (bg, bg-solid, border, highlight, shadow, glow, inner-glow, icon-color), `--success / --success-foreground`, `--warning / --warning-foreground`, `--info / --info-foreground`, `--cta-start / --cta-end / --cta-start-hover / --cta-end-hover / --cta-foreground` |
| Derived | Roadmap tokens delegate to ladder (`roadmap-theme.css`) → automatically themed when ladder values change; no per-theme override needed unless a palette needs special roadmap accent tuning |

> **No new CSS vars** unless needed for shared concepts. If a component introduces a new semantic need, register in `@theme inline` (e.g., `--color-success: var(--success)` already there).

---

## 4. The Five New Palettes — Design Spec

> Default is the current neutral (gray: ~0 chroma). Five new themes must be hue-distinct by ≥ 35°, chroma ≥ 0.03 in at least one of `primary`/`accent`/`chart-*`, and remain **muted/professional** (no saturated neons). All examples use `oklch()` to match existing codebase.

### Palette Identities (proposals — refine tokens in implementation tickets, not in this plan)

1. **Tide** — *Cool slate / blue-gray.* Quiet professional, slightly colder than default. For users who want a “studio” feel without warmth. Hue ~250–260, low chroma (0.02–0.04). CTA leans indigo-slate.

2. **Grove** — *Sage / moss.* Organic, calm, paper-like. Warm greens with desaturated olive secondary. Good for long reading sessions. Hue ~140–155 for accent, background stays warm-white (chroma ~0.01) so text remains gray-dominant.

3. **Dune** — *Warm sand / clay.* Earthy amber-taupe, reminiscent of paper and terracotta. Light mode background is a very light warm eggshell (not yellow), dark mode is warm charcoal (not pure black). Hue ~60–80.

4. **Ember** — *Burnished terracotta / brick.* Confident but muted red-orange. Uses restrained red only on `primary`/`accent`/`destructive` family; surfaces stay neutral-warm so the accent doesn’t tint body text. Hue ~30–40.

5. **Plum / Iris** — *Dusted violet / ink.* Evening, focused, slightly more saturated than the others but still desaturated enough for all-day use. Hue ~290–310. Dark mode is near-indigo graphite, light mode uses lavender-gray accents.

Each palette snapshot must provide:
- One-line personality + intended audience
- Light + dark swatch pair (light/dark values for surfaces and text)
- `primary`/`primary-foreground` pair that hits **≥ 4.5:1** vs its foreground in both modes
- `chart-1..5` set derived from the same hue family (or analogous), not copied from default

**Distinctiveness guardrail:** At a glance, all six theme previews (default + five) should be distinguishable even in grayscale thumbnail by *lightness/temperature* alone. If two palettes look interchangeable on a laptop in daylight, re-tune chroma/hue.

---

## 5. CSS Structure & File Changes (Clean + shadcn-Consistent)

### 5.1 Global Import Order (unchanged philosophy)

`frontend/src/globals.css:1-16` stays:

```css
@import "tailwindcss";
@import "./typeset.css";
@import "@fontsource/...";
@import "katex/dist/katex.min.css";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@import "./styles/tokens.css";       /* app extensions (default light) + .dark overrides */
@import "./styles/themes.css";       /* ★ NEW — 5 new themes (light + dark each) — after tokens.css so it overrides */
@import "./styles/base.css";         /* element defaults (@layer base) — unchanged */
@import "./styles/utilities.css";    /* z-index, liquid-glass — unchanged */
@import "./styles/components.css";   /* btn-cta etc. — unchanged */
@import "./styles/overrides.css";    /* dialog scoped dark tweaks — may need per-theme scoping audit */
@import "./styles/motion.css";       /* reduced-motion — unchanged */
```

### 5.2 New File: `frontend/src/styles/themes.css`

- Single file, **not** a folder (avoids import-order surprises; we can split later if it exceeds ~500 LOC).
- Header comment: purpose, naming convention, and rule that **default values never live here** — only `[data-theme="..."]` overrides.
- Structure:

```css
/* themes.css — 5 additional palettes. Default lives in globals.css + tokens.css. */
html[data-theme="tide"] { /* light tide */ }
html.dark[data-theme="tide"] { /* dark tide */ }

html[data-theme="grove"] { /* light grove */ }
html.dark[data-theme="grove"] { /* dark grove */ }

/* … dune, ember, plum … */
```

- Each block re-declares **only tokens that change** from default; missing tokens fall through to default (keeps file smaller). But for auditability, prefer **explicit full listing** per theme for core tokens, since falling through makes contrast auditing harder. Decision: list full core + ladder + composer + semantic per theme; reuse default only for `--radius`, `--font-*`, etc.

### 5.3 `@theme inline` (no change expected)

Existing `globals.css:20-92` already maps every semantic var to a Tailwind color (e.g., `--color-surface-2: var(--surface-2)`). New themes **don’t add new vars**, so no `@theme inline` edit is needed. If a palette needs a genuinely new semantic (e.g., `--color-accent-strong`), then: 1) add var in `themes.css`, 2) add line in `@theme inline`. Check via `npx shadcn@latest info` that `tailwindVersion: v4`.

### 5.4 Preservation Contract

- `globals.css:94-164` **content is frozen** (byte-identical). If formatting tooling rewrites it, guard with a test: `git diff -- globals.css` must be empty after theme work.
- `tokens.css` **default light** (`:root`) and **default dark** (`.dark`) blocks are frozen as well. `themes.css` is additive.
- Hard-coded `text-[#171717]` in `settings-page.tsx:91` must be removed before or alongside theme work; otherwise that icon “pops” only in default theme.

---

## 6. Theme Switching, Persistence & FSD Placement

### 6.1 State Shape

```ts
type ThemeName = "default" | "tide" | "grove" | "dune" | "ember" | "plum";
type ColorScheme = "light" | "dark" | "system";

interface ThemeState {
  theme: ThemeName;          // palette
  scheme: ColorScheme;       // mode — mirrors next-themes but single source of truth
  resolvedScheme: "light" | "dark"; // derived (system → matchMedia)
}
```

Storage keys (localStorage, `localStorage.getItem` — no backend):
- `memsystems-theme` → `ThemeName` (default `"default"`)
- `memsystems-scheme` is actually handled by `next-themes` key `theme` (default `"system"`). Options:
  - **Option A (recommended): keep next-themes key** `memsystems-scheme` by setting `ThemeProvider(storageKey="memsystems-scheme")`. Keep `memsystems-theme` separate for palette. Two keys, clear separation.
  - Option B: unify under one key object — more migration, no benefit.

### 6.2 Provider Composition

```
<AppProviders>
  <PaletteProvider>               // ★ NEW  — sets html[data-theme], persists memsystems-theme
    <ThemeProvider                 // existing — sets html.dark, persists scheme
      attribute="class" defaultTheme="system" enableSystem storageKey="memsystems-scheme"
    >
      <ThemeKeyboardShortcut/>     // extended to cycle resolvedScheme, still respects quiz guard
      {children}
    </ThemeProvider>
  </PaletteProvider>
</AppProviders>
```

- **`PaletteProvider`** (`features/theme/model/palette-provider.tsx` or `shared/theme/` — see §6.4):
  - On mount + on `theme` change: `document.documentElement.setAttribute("data-theme", theme)`; if `theme==="default"` remove attribute (or keep `"default"` — decide and be consistent; removing keeps CSS simpler: `[data-theme="x"]` overrides only when present).
  - Syncs `localStorage["memsystems-theme"]`.
  - SSR-safe: `typeof window !== "undefined"` guard; no hydration mismatch because attribute is set before first paint via `index.html` script (§6.3).
- `usePalette()` hook exposes `{ theme, setTheme, themes, resolvedTheme }` (like `useTheme()` for palette).
- `useScheme()` can just be `useTheme()` from `next-themes`; no wrapper needed unless we want to merge APIs.

### 6.3 FOUC Prevention

Add a **blocking inline script** in `frontend/index.html:12` inside `<head>` *before* `<link href="/src/globals.css">` (so it runs before first paint), mirrored from `next-themes`’ approach:

```html
<script>
  try {
    var t = localStorage.getItem("memsystems-theme") || "default";
    if (t && t !== "default") document.documentElement.setAttribute("data-theme", t);
    // next-themes handles .dark; its script runs after. Ensure palette is set first.
  } catch {}
</script>
```

- Keep the script tiny, no async, no CSP violation (no eval).
- After React mounts, `PaletteProvider` takes over and keeps the attribute in sync.

### 6.4 FSD Placement Decision

| Option | Path | Pros | Cons |
|--------|------|------|------|
| **A — `features/theme/`** (recommended) | `frontend/src/features/theme/{model/ui/lib}/` | Theme is “user preference as business feature” (like `ai`, `notebook-chat`), gets its own barrel, tested like a feature, imports cleanly into `pages/settings`. Follows existing feature pattern. | `app/providers` importing from `features/` is upward (app → features is allowed downward? FSD says app may import from features — actually app is top layer, can import from any lower layer, so allowed.) |
| B — `shared/theme/` | `frontend/src/shared/theme/` | Feels “generic” | Pollutes `shared` with business state; `shared` is meant to be generic kit |
| C — `app/theme/` | `frontend/src/app/theme/` | Co-located with providers | `app/` should stay thin (only composition); business logic belongs in feature |

**Recommendation: A — `features/theme`**. Export public API from `features/theme/index.ts`:

```ts
export { PaletteProvider } from "./model/palette-provider";
export { usePalette } from "./model/use-palette";
export { THEMES, type ThemeName } from "./model/themes";
export { ThemeGrid } from "./ui/theme-grid";
export { SchemeSelector } from "./ui/scheme-selector";
```

`app/providers/index.tsx` imports `{ PaletteProvider } from "@/features/theme"` — allowed (app → features).

### 6.5 Keyboard Shortcut (existing `d` toggle)

Keep `ThemeKeyboardShortcut` in `app/providers/index.tsx:14-46` but extend:
- Currently toggles `resolvedTheme` dark/light. Keep behavior.
- Respect `data-quiz-active="true"` guard already there.
- Future: `Shift+D` could cycle palette — out of scope, not in plan.

---

## 7. Appearance UI — Selection Concept (Image as Layout Inspiration)

### 7.1 What to Borrow from the Image

- **Two-level chooser**: top row = *Color scheme* (System / Light / Dark) with realistic UI previews (not just icons); bottom grid = *Themes* (6 cards) with **dual-preview orbs** (light + dark swatch pair) and selected ring.
- **Card chrome** from the image is *not* borrowed: no creation/import buttons, no copy icon, no dark-page container styling. Rebuild chrome with Memsystems surface ladder and shadcn card.

### 7.2 Proposed IA on `settings-page.tsx`

Currently:
```
Settings header
  └─ AI providers card
  └─ “Your keys / Appearance” two-col grid (Appearance is the small segmented control)
```

Proposed:
```
Settings header
  └─ AI providers card
  └─ Appearance section (full-width, separated from “Your keys” card)
       ├─ Section title + description (“Choose how Memsystems looks. Theme affects palette; Color scheme affects light/dark.”)
       ├─ Color scheme — radiogroup with 3 options (System / Light / Dark)
       │     Each option: miniature window mock (like image: header + sidebar + content + slider hint)
       │     Use bg-surface-* inside the mock so preview reacts to current theme
       └─ Themes — grid (responsive: 1 col mobile, 2 cols sm, 3 cols md)
             6 cards: Default, Tide, Grove, Dune, Ember, Plum
             Each card: two overlapping circles (light orb left-overlap, dark orb right-under) + theme name + check/selected ring
             Radiogroup semantics, keyboard navigation (arrow keys)
```

### 7.3 Component Breakdown

- **`SchemeSelector`** (`features/theme/ui/scheme-selector.tsx`):
  - `role="radiogroup"` + `aria-label="Color scheme"`, 3 `role="radio"` buttons.
  - Reuses current `settings-page.tsx:463-489` icon set (Sun/Moon/Monitor) plus a new tiny preview illustration per option (pure CSS: rounded rect with `bg-background`/`bg-card`/`bg-surface-2` blocks — avoids image assets).
  - Calls `setTheme(value)` from `next-themes` (or `setScheme`).

- **`ThemeGrid`** (`features/theme/ui/theme-grid.tsx`):
  - `role="radiogroup"` + `aria-label="Theme"`.
  - Maps `THEMES` array; each `ThemeCard` is `role="radio"` + `aria-checked`.
  - Visual: container `rounded-[min(var(--radius-4xl),24px)] bg-card border border-border/70`, inner orb canvas `aspect-[16/10]` or similar, two radial gradients for light/dark swatches. Use CSS `radial-gradient` driven by theme’s own tokens (see §7.4).
  - Selected state: `ring-2 ring-primary ring-offset-2 ring-offset-background` + `border-primary/40` + check icon `bg-primary text-primary-foreground`. Unselected: `hover:border-border-strong`.
  - Focus: `focus-visible:ring-2 ring-surface-border-strong` (follows `color-hierarchy` skill).

- **`ThemePreviewOrb`** helper (inside `ThemeGrid`): renders two overlapping circles. Background for light orb = theme’s `--background` (or `--surface-1`); dark orb = theme’s dark `--background`. Implementation note: orbs can’t easily read “other mode’s” token at render time, so either:
  - Inline CSS custom properties per card computed from a JS token map (e.g., `style={{ "--preview-light": THEME_TOKENS.tide.light.background }}`), **or**
  - Hard-code preview gradients in the card’s `className` using the same `oklch()` literals that `themes.css` uses (duplicated but visual-only). Prefer the **token map** approach to keep single source of truth.

### 7.4 Token Map (Single Source for Previews & Metadata)

```ts
// features/theme/model/themes.ts
export const THEMES = [
  { id: "default", label: "Default",  description: "Neutral — what you see today", ... },
  { id: "tide",    label: "Tide",     description: "Cool slate",  hue: 255, accent: "oklch(...)", preview: { light: "oklch(...)", dark: "oklch(...)" } },
  // … grove, dune, ember, plum
] as const;
```

- Used to render `ThemeGrid` without reading computed styles (avoids hydration mismatch).
- Also drives `aria-label`s and docs; not used as runtime CSS source (CSS remains the source of truth for the app).

### 7.5 Accessibility of the Picker

- Radiogroup pattern gives free keyboard support (Space/Enter to select, arrows to move). Ensure `tabIndex` management or use `roving tabindex` (Radix radio group wraps it).
- Each card must have a visible **text label** (`Default`, `Grove`, …); orbs are `aria-hidden`.
- Selected state conveyed by both visual ring **and** `aria-checked` + `aria-label="Tide, selected"` or visually hidden “Selected” text.
- Do **not** rely on color alone to convey selection (hence the ring + check).

---

## 8. Light / Dark-Mode Behavior (System Included)

- **Source of truth**: `next-themes` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `storageKey="memsystems-scheme"`, `disableTransitionOnChange` (existing).
- **System resolution**: `resolvedTheme` = `"light"` | `"dark"` computed from `prefers-color-scheme`. Palette (`data-theme`) is independent — system only affects light vs dark variant of the chosen palette.
- **Preview cards** (color-scheme row) show a **schematic window** (header/sidebar/content/slider) using semantic surfaces so they look correct under the active palette. Optional enhancement: show each scheme preview rendered in its own palette variant (system card could be split-diagonal like the image’s System preview — half-light/half-dark). Keep implementation simple first: previews use current `resolvedTheme` for coloring and are labeled clearly.
- **No per-theme forced mode**: every palette supports both light and dark. Don’t ship a palette that is “dark only”.
- **Browser preferences**:
  - `prefers-reduced-transparency` — composer glass already falls back to `--composer-bg-solid` (`motion.css:12-18`); verify still works for all themes (composer tokens are per-theme).
  - `prefers-contrast: more` — optional future; not in scope, but tokens should not degrade at high contrast.
  - `forced-colors: active` — test that semantic tokens degrade gracefully (borders remain visible, `outline-ring` still works). Don’t override `forced-colors`.

---

## 9. Accessibility Requirements (Per-Theme Contract)

### 9.1 Contrast Budgets (WCAG AA minimum, AAA where feasible)

Measure with a contrast checker on **actual computed values** (not source oklch strings) for both light and dark variants:

| Pair | Requirement | Typical Use |
|------|-------------|-------------|
| `--foreground` on `--background` | ≥ 7:1 | Body text, headings |
| `--text-primary` on `--surface-0/1` | ≥ 7:1 | Primary UI text |
| `--text-secondary` / `--text-tertiary` on `--surface-1/2` | ≥ 4.5:1 | Body, secondary labels |
| `--text-faint` on `--surface-2` | ≥ 4.5:1 (floors per `color-hierarchy` — dimmest allowed, must remain legible) |
| `--muted-foreground` on `--muted` / `bg-muted` | ≥ 4.5:1 |
| `--primary-foreground` on `--primary` (buttons) | ≥ 4.5:1 | Primary buttons, selected checks |
| `--sidebar-foreground` on `--sidebar` | ≥ 4.5:1 |
| `--border` vs `--background` / `--card` vs `--background` | at least 1.2:1 luminance step (visible card outline without relying on shadow) — verify ladder step is perceptible (§9.3) |
| Focus ring (`--ring`) on `--background` | must be visible at 2px (the `color-hierarchy` skill mandates `ring-surface-border-strong` + `ring-2`) |

### 9.2 Tooling
- During token authoring: use `oklch` → `sRGB` conversion + APCA or WCAG contrast; validate with `axe-core` in Vitest/jsdom or manual `color-contrast` check.
- Add a **CI-checkable test**: `frontend/src/features/theme/model/themes.contrast.test.ts` that imports token map and asserts contrast ratios (compute luminance from `oklch()` via a helper). Fail the PR if a new palette dips below budgets.
- Manual pass with macOS “Increase contrast” and Windows High Contrast (`forced-colors: active`) emulated in DevTools.

### 9.3 Surface Ladder Rule (from `color-hierarchy` skill)
- **Every nested surface steps one tone.** Page `surface-0` → card `surface-1` → row `surface-2` → selected `surface-3` → pressed `surface-4`. Test on both light and dark for each palette: if `surface-1` and `surface-2` are indistinguishable in Tide-dark, the palette is wrong — don’t patch with opacity.
- Borders: `subtle` (hairline), `border` (card outline), `strong` (small controls). Never invent a fourth border token for a single theme.
- Text: no `opacity-50` or `text-muted-foreground/60` for de-emphasis; always `text-faint`.
- **Structure never wears accents:** tree roots, steppers, progress bars, position indicators use ladder tones, not `bg-primary`. Palettes that tint the ladder with hue (e.g., Dune’s warm `surface-1`) must keep chroma low so the ladder still reads as “structure”, not “action”.

### 9.4 Motion & Preferences
- Respect `prefers-reduced-motion: reduce` — theme switch itself should not animate background color if `disableTransitionOnChange` is on; any picker animations (card hover, ring) must be `transition-duration: 0.01ms` under that media query (already in `motion.css`).
- `prefers-reduced-transparency: reduce` — composer becomes solid; verify per-theme `composer-bg-solid` is opaque and meets contrast.

---

## 10. Component Audit & Guardrails (Avoid Hardcoded Colors)

### 10.1 Audit Checklist

Search before and after (CI `oxlint` rule or `grep`):

```bash
# should return ~0 (except legitimate color-mix on semantic vars)
rg -n "bg-\[|text-\[#|border-\[#|#([0-9a-fA-F]{3,8})\b|oklch\(.*\)" frontend/src --glob '*.{ts,tsx}' | grep -v "color-mix(in"
rg -n "hardcoded|#171717" frontend/src --glob '*.{ts,tsx,css}'
```

- Replace `text-[#171717]` in `settings-page.tsx:91` with `text-foreground` or a semantic icon token.
- Keep `color-mix(in oklch, var(--secondary), var(--foreground) 5%)` style usages — they’re semantic.
- Shimmer `bg-[length:250%_100%,auto]` is not a color — keep.
- `composer-bg` glass values intentionally keep `oklch(... / alpha)` — they’re tokenized, not hard-coded in components.

### 10.2 Lint Enforcement (optional but recommended)

- Add `oxlint` custom rule or leave a checked-in `scripts/audit-theme-colors.mjs` that fails CI if a component introduces a raw hex/oklch literal outside `tokens.css`/`themes.css`/`code-block.tsx` Shiki.

---

## 11. Affected Files — Change Matrix

| File | Action | Notes |
|------|--------|-------|
| `frontend/src/globals.css` | **No semantic edit** (add one import line) | Add `@import "./styles/themes.css";` after `tokens.css`. Keep `:root`/`.dark` blocks identical — verified by `git diff`. |
| `frontend/src/styles/tokens.css` | Preserve default blocks | If any default token value needs tuning for consistency with new theming, do it in a separate PR before this work. No edits for this feature except fixing any discovered inconsistency (flagged). |
| `frontend/src/styles/themes.css` | **NEW** | Contains all 5 palettes × 2 modes. One file, ~300–500 lines. Own header comment. |
| `frontend/src/styles/base.css` | No change |  |
| `frontend/src/styles/utilities.css` | No change | Glass utilities must work with new `composer-*` per theme — test, don’t edit. |
| `frontend/src/styles/overrides.css` | **Audit / maybe extend** | Dark dialog overrides hard-code `oklch(0.23 0 0)` etc. Under new palettes, those hard-codes will clash (dialog will look wrong in Plum-dark etc.). Options: (a) scope overrides to `default` only (`html:not([data-theme]) .dark [data-slot="dialog-content"]` plus `html[data-theme="default"]...`), or (b) move overrides to be token-driven / per-theme. Ticket this separately if scope is large; at minimum document it. |
| `frontend/index.html` | Edit `<head>` | Add blocking `data-theme` restore script before CSS link (see §6.3). |
| `frontend/src/app/providers/index.tsx` | Edit | Wrap `ThemeProvider` with `PaletteProvider`; extend `ThemeKeyboardShortcut` if needed; pass `storageKey="memsystems-scheme"` explicitly. |
| `frontend/src/features/theme/model/themes.ts` | **NEW** | `THEMES` const, `ThemeName` type, preview token map. |
| `frontend/src/features/theme/model/palette-provider.tsx` | **NEW** | Provider + hydration logic. |
| `frontend/src/features/theme/model/use-palette.ts` | **NEW** | Hook re-export. |
| `frontend/src/features/theme/model/themes.contrast.test.ts` | **NEW** | Contrast budget tests. |
| `frontend/src/features/theme/ui/theme-grid.tsx` | **NEW** | Grid + card. |
| `frontend/src/features/theme/ui/scheme-selector.tsx` | **NEW** | Color-scheme row. |
| `frontend/src/features/theme/index.ts` | **NEW** | Barrel. |
| `frontend/src/pages/settings/ui/settings-page.tsx` | Edit | Extract small Appearance card into `SchemeSelector` + `ThemeGrid` composition; keep provider rows untouched. Minor layout refactor to make Appearance full-width section. |
| `frontend/src/shared/ui/*.tsx` | No change (except Kimi icon fix) | Verify no theme-specific forks. |
| `docs/plans/themes-six-plan.md` | **NEW** (this file) | Living plan. |
| `docs/design/themes-tokens.md` | **NEW** (post-plan, optional) | Captured decision log per palette’s final `oklch` values. |
| `frontend/README.md` / `docs/architecture.md` | Update (follow-up) | Add theme section once shipped. |

> Keep PR to **≤ 8 files** + `themes.css` if possible; split into stacked PRs per §12.

---

## 12. Implementation Plan — Phased Tickets

> Each phase is a vertical slice that can be reviewed/merged independently. Do not mix palette tuning with provider plumbing.

### Phase 0 — Scaffolding & Contracts (no visible change)

**Ticket T0.1 — Repo audit & frozen snapshot**
- Capture `git show HEAD:frontend/src/globals.css` + `tokens.css` hash in the PR description as “default frozen”.
- Add `text-[#171717]` fix (replace with semantic) as a tiny pre-PR so themes PR isn’t blocked by that outlier.
- Add the FOUC script placeholder (no-op) and confirm `pnpm run build` + `pnpm run typecheck` pass.

**Ticket T0.2 — `features/theme` skeleton**
- Create folder `frontend/src/features/theme/{model,ui}/` + `index.ts` barrel.
- Add `THEMES` array with 6 entries (default + 5 ids) and `ThemeName` type, no CSS yet.
- Add `PaletteProvider` that reads/writes `localStorage["memsystems-theme"]` and sets `data-theme` attribute. Start with attribute removal for default (no attribute) to keep CSS simple.
- Wrap `AppProviders` with `PaletteProvider`; prove it doesn’t break existing light/dark toggles (manual: toggle `d`, pick System, reload).
- Tests: unit test `use-palette` + storage mock (Vitest).

### Phase 1 — CSS Theme Tokens (no UI yet, but themes switchable via console)

**Ticket T1.1 — `styles/themes.css` with Tide (one pilot palette)**
- Author **one** finished palette (recommend Tide — most conservative, best contrast baseline) with both light + dark blocks.
- Manually verify contrast budgets (§9) for Tide-light and Tide-dark before merging.
- Add `overrides.css` audit note for dialog tokens under Tide (does dialog still need per-theme?).

**Ticket T1.2 — Remaining 4 palettes (Grove, Dune, Ember, Plum)**
- Add 4 blocks to `themes.css`. Each palette gets its own review (PR sub-patch) with contrast evidence (screenshot of contrast checker).
- Keep token ordering identical across palettes (same line order) so `diff` is scannable.
- Run `pnpm run lint && pnpm run typecheck` after each palette.

**Exit criteria Phase 1:** `localStorage.setItem("memsystems-theme","grove"); location.reload()` correctly tints the whole app (chat, notebook workspace, settings, dialogs) with no un-themed component found.

### Phase 2 — Appearance UI (Image-Inspired Picker)

**Ticket T2.1 — `SchemeSelector`**
- Build the 3-option color-scheme row (Light/Dark/System) with mini window preview (CSS-only).
- Replace `settings-page.tsx`’s segmented control with `<SchemeSelector />` (prop-drilled `useTheme()` or new thin wrapper).
- A11y: radiogroup semantics, keyboard nav, focus ring per ladder.

**Ticket T2.2 — `ThemeGrid` + `ThemeCard`**
- Build the 6-card grid (Default + 5 new) with dual orb preview + selected ring + check.
- Responsive: 1 col xs, 2 cols sm, 3 cols lg (matches image’s 3-col).
- Wire `onSelect` to `setTheme(id)` via `usePalette()`.
- Tests: `userEvent.click` selects theme, `localStorage` updated, `data-theme` attribute set, `axe` no violations.

**Ticket T2.3 — Polish & empty/error states**
- Loading state for theme (no async, but still handle `window` undefined).
- Ensure “no theme selected” impossible (always fall back to `default`).
- Add `@media (prefers-reduced-motion: reduce)` suppression for card transitions.

### Phase 3 — Verification & Hardening

**Ticket T3.1 — Contrast audit + `themes.contrast.test.ts`**
- Computed-contrast test suite that parses `themes.css` or token map and asserts budgets.
- Use `axe-core` or custom `oklch→srgb→luminance` helper (commit the helper so future palettes reuse it).

**Ticket T3.2 — Visual regression**
- Manual matrix: 6 themes × 3 schemes = 18 screenshots (notebook workspace + settings). Or automate with Playwright if available (not assumed).
- Test `forced-colors: active` emulation and `prefers-contrast: more`.

**Ticket T3.3 — Perf / bundle**
- Verify `themes.css` adds < 8 kB gzipped, no extra runtime JS beyond provider.

### Phase 4 — Docs & Cleanup (follow-up PR)

- Update `docs/architecture.md: Frontend` with “Theming” subsection.
- Add `docs/design/themes-tokens.md` logging each palette’s final `oklch` values + rationale.
- Remove any dead code, ensure `pnpm run lint`, `typecheck`, `test` green (Quality Gate: `lint -> typecheck -> test`).

---

## 13. Light/Dark-Mode Behavior — Detailed

| Interaction | Expected |
|-------------|----------|
| User picks **Theme = Grove, Scheme = System** | Grove-light by day, Grove-dark by night, auto-updates on OS change (`next-themes` listens to `prefers-color-scheme`) without reload |
| User picks **Scheme = Light** then `d` shortcut | `d` flips `resolvedTheme` → Scheme updates to Light/Dark (leaves Theme untouched). Press `d` again flips back. Query `[data-quiz-active="true"]` still blocks toggle |
| User picks **Theme = Default** | `data-theme` removed (or `="default"`); app looks exactly as today for both light and dark. Verified by pixel-diff |
| Persistence | Reload / new tab retains both Theme and Scheme via `localStorage`. Clearing `localStorage` + reload returns to Default + System |
| SSR / hydration | `index.html` blocking script sets `data-theme` synchronously before paint; `next-themes` script sets class; React hydration sees matching attributes → no mismatch warning |
| `prefers-reduced-motion` | `disableTransitionOnChange` suppresses global color transition on scheme switch; card interactions use short `200ms ease` but collapsed to `0.01ms` under the media query |

---

## 14. Theme Switching & Persistence — API Sketch

```ts
// features/theme/model/use-palette.ts
export function usePalette(): {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  themes: readonly ThemeMeta[];
  isHydrated: boolean;
};

// PaletteProvider internals
const STORAGE_KEY = "memsystems-theme";
function applyAttribute(theme: ThemeName) {
  const el = document.documentElement;
  if (theme === "default") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", theme);
}
// Subscribe to storage events (optional) for multi-tab sync:
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY && e.newValue) applyAttribute(e.newValue as ThemeName);
});
```

- No backend call. Future enhancement could `POST /api/preferences/theme` if user wants cross-device sync — not in scope.
- Guard malformed storage: `JSON.parse` not needed (plain string); validate against `THEMES` set; fall back to `"default"`.

---

## 15. Accessibility Requirements — Consolidated

1. **WCAG AA (4.5:1) on all text** — see budgets in §9.1. Block merge if any palette fails.
2. **Keyboard** — Appearance pickers are `radiogroup`/`radio`, Tab lands on the group, arrows move, Space selects. Focus ring always visible (`ring-2 ring-surface-border-strong`).
3. **Screen reader** — cards announce “Grove, theme, 2 of 6, not selected” (radix-like). Selected card has `aria-checked="true"` and optional offscreen “Selected”.
4. **Reduced motion** — `motion.css` already collapses transitions; theme switch itself is instant under `disableTransitionOnChange`.
5. **Forced colors** — no `background: none` tricks; borders and rings must still render; test with `forced-colors: active`.
6. **No color-only signal** — selection shows ring + check + label weight, not just orb hue.

---

## 16. Verification Steps (Quality Gate)

> Run per-phase; full gate before final merge.

### 16.1 Automated

```bash
# from repo root
pnpm run lint                          # oxlint + per-package ESLint (backend)
pnpm run typecheck                     # tsc --noEmit in both packages
pnpm --filter frontend run test        # Vitest (includes themes.contrast.test.ts, use-palette.test.ts)
pnpm exec --filter frontend oxfmt --check src  # if formatting required

# optional shell checks (paste into pwsh)
rg -n "bg-\[.*oklch|text-\[#|#171717" frontend/src --glob '*.{ts,tsx}'  # should be ~0
git diff -- frontend/src/globals.css   # should be only the import line (T1) else fail
git diff -- frontend/src/styles/tokens.css  # should be empty
```

### 16.2 Manual — Palette × Mode Matrix (18 states)

For **each** of 6 themes × `{light, dark, system→dark via OS toggle}`:
1. `pnpm run dev`, open `http://127.0.0.1:3000/settings`, pick the theme + scheme.
2. Reload — theme persists, no FOUC (background not flashing white).
3. Visit `/notebooks/<id>` — check:
   - Notebook workspace panels (`desktop-layout.tsx:136` card, `panel-bg`, `studio-resource`, `composer` glass)
   - Sources list, study-materials tree (ladder steps still perceptible — no two adjacent surfaces same tone)
   - Chat composer (glass glow correct — `composer-glow`/`inner-glow` per theme)
   - Dialog (`GenerateBriefDialog`) — scoped overrides still subtle, not high-contrast glare (§5.4)
4. Toggle `d` — flips light/dark within the same palette (quiz guard tested on `/notebooks/<id>` with a quiz viewer open).
5. Switch OS dark mode (or DevTools Rendering → emulate `prefers-color-scheme`) while on System — app follows without reload.

### 16.3 Accessibility

- Run **axe DevTools** on `/settings` and `/notebooks/<id>` for each palette (light + dark) — 0 serious violations.
- Check **contrast** with DevTools → Computed → Background/Text (or `polished`’s `getContrast`) for `text-faint` on `surface-2` + `primary-foreground` on `primary`.
- Emulate `prefers-reduced-motion: reduce` and `forced-colors: active` — layout intact, focus rings visible.
- Tab through Appearance pickers — focus ring present, `aria-checked` toggles correctly.

### 16.4 Performance

- Lighthouse (desktop) on `/settings` and `/notebooks/<id>` for default vs. darkest palette — no regression > 3 points.
- Bundle: `themes.css` contribution < 8 kB gzipped (check `pnpm run build` output).

---

## 17. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Dialog overrides break non-default palettes** (`overrides.css` hard-codes gray) | Scope overrides to `default` (attribute not present) or convert to semantic tokens; ticket T1.1 covers |
| **FOUC on first paint** (white flash before `data-theme` set) | Blocking `<head>` script before CSS; `next-themes` already does the same for `.dark` |
| **Hydration mismatch** (`data-theme` on server vs. client) | Guard `typeof window`, set attribute only client-side; server renders without `data-theme` (default) — client corrects before hydration warnings by the blocking script |
| **Contrast regression** (faint text becomes unreadable in warm dark palettes) | Budgets + automated contrast test; author palettes with chroma low on surfaces, high on accent only |
| **Bundle drift / hardcoded colors reintroduced** | `rg` lint check in CI + code review checklist: “any new `#[0-9a-f]` or `oklch(` in `.tsx`?” |
| **Default accidentally drifted** | Frozen snapshot + `git diff` gate in PR template |

---

## 18. Open Questions (Resolved or Ticketed)

- **Default attribute vs. no attribute?** Recommendation: no `data-theme` for default (CSS overrides only when present). If DX prefers `data-theme="default"` everywhere, then `html[data-theme="default"]` must be kept identical to `:root` (duplication risk). Preferred is no attribute.
- **Backend persistence?** Out of scope now; add `POST /api/preferences` later if cross-device needed.
- **“Create theme / Import theme” buttons (image)?** Not implemented; could be a follow-up feature (`features/theme` already has a clean extension point: add `CustomThemeProvider`).
- **Chart colors: per-theme or shared?** Per-theme, derived from palette hue family — already in token coverage.

---

## 19. Sequencing (Minimal Stacked PRs)

```
PR1 (T0):  skeleton + PaletteProvider + FOUC script + kimi icon fix  (no CSS palette yet)
PR2 (T1.1): themes.css — Tide only (+ overrides.css audit)
PR3 (T1.2): themes.css — Grove, Dune, Ember, Plum (review each palette)
PR4 (T2.1+2.2): SchemeSelector + ThemeGrid wired on settings-page.tsx
PR5 (T3):  contrast tests + docs + gate
```

Each PR satisfies `lint → typecheck → test` before merge. After PR5, default still looks identical to today.

---

## 20. Appendix — Example `themes.css` Scaffold (Illustrative — Not Final Tokens)

```css
/* frontend/src/styles/themes.css — 5 new palettes */

/* Tide — cool slate (light) */
html[data-theme="tide"] {
  --background: oklch(0.985 0.01 250);
  --foreground: oklch(0.18 0.015 250);
  --card: oklch(0.990 0.008 250);
  --card-foreground: oklch(0.18 0.015 250);
  /* … remaining tokens in same order as globals.css … */
  --surface-0: oklch(0.985 0.01 250);
  --surface-1: oklch(0.975 0.008 250);
  /* … */
  --composer-bg: oklch(0.99 0.006 250 / 0.6);
}
html.dark[data-theme="tide"] {
  --background: oklch(0.16 0.015 250);
  --foreground: oklch(0.985 0.005 250);
  /* … */
}

/* Next palettes follow the same shape: html[data-theme="grove"], html.dark[data-theme="grove"], etc. */
```

Final `oklch` numbers to be chosen in T1.2 with contrast evidence attached to the PR, not guessed here.

---

## 21. Handoff Checklist for Implementer

- [ ] Read `frontend/src/globals.css:94-164` + `styles/tokens.css:1-138` + `app/providers/index.tsx:76` before editing.
- [ ] Create `features/theme` slice per FSD; keep `globals.css` import order as in §5.1.
- [ ] Author palettes using only tokens in §3.2; never write a component-level `bg-[#...]`.
- [ ] Verify each palette in both light and dark with the 18-state manual matrix + axe.
- [ ] Keep `git diff frontend/src/globals.css` to the single import line until PR5.

