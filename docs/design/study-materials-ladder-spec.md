# Study Materials — Surface Ladder Design Spec

This spec governs the UI refactor of the study-materials viewer and generation dialogs.
Read `.agents/skills/color-hierarchy/SKILL.md` first — this document applies its rules to
these two areas and settles every open decision so all agents produce identical output.

> **Scope boundary:** the ladder applies to the **generation dialogs** and the
> **study-materials viewer** (including the expanded-study-materials dialogs that host
> it). The **study-materials tree panel embedded in the studio workspace** keeps the
> original panel tokens (`panel-bg`, `panel-header-bg`, `muted`, …) so it stays
> consistent with the Sources/Chat/Studio panels beside it.

## 1. Context → ladder mapping (authoritative)

| Context | Background | Border | Text |
|---|---|---|---|
| App page behind everything | `bg-surface-0` | — | — |
| Expanded viewer dialog / GenerateBriefDialog / MaterialViewer shell | `bg-surface-1` | `border-surface-border` | heading `text-text-primary` |
| Dialog headers / section headers | `bg-surface-1` | `border-surface-border-subtle` (bottom hairline) | `text-text-primary` |
| Form rows, option rows, inputs, list rows resting on a dialog | `bg-surface-2` | `border-surface-border-subtle` | `text-text-tertiary` |
| Hover on a row/control | `bg-surface-3` | unchanged | `text-text-secondary` |
| Selected / active row | `bg-surface-3` | `border-surface-border` | `text-text-secondary` |
| Pressed / deepest inset (wells, code blocks, progress tracks) | `bg-surface-4` | — | `text-text-faint` |
| Small interactive controls: letter circles, steppers, icon buttons | parent tone | `border-surface-border-strong` | `text-text-secondary` |
| Tree rows in the files panel | `bg-surface-0` (panel) | — | `text-text-tertiary` |
| Tree row hover / selected | `bg-surface-2` / `bg-surface-2` + `border-surface-border` | | `text-text-primary` when selected |

Rule: each nested layer steps exactly one tone above its container. State changes step
along the ladder (rest → hover = +1, selected = +1 with the stronger border).

## 2. Component recipes (from the reference mockups)

### Option row (quiz answer, difficulty picker, card-style radio, phase preset, structure picker)
```
rounded-2xl border bg-surface-2 border-surface-border-subtle px-4 py-3
hover:bg-surface-3
selected: bg-surface-3 border-surface-border
```
- Leading letter/icon circle: `size-8 rounded-full border border-surface-border-strong text-[16px] font-semibold text-text-secondary` (selected: `text-text-primary`)
- Label: `text-[16px] font-semibold` — `text-text-tertiary` resting, `text-text-secondary` selected
- The selected row is distinguished by tone + border + text weight, never by opacity.

### Card / dialog container
```
rounded-3xl bg-surface-1 border border-surface-border
```
Inner sections sit on `surface-2`; no shadows for depth.

### Stepper / segmented control
Track: `bg-surface-4 rounded-full p-1`. Active segment: `bg-surface-1 rounded-full text-text-primary` (steps *down* — raised chip on an inset well). Inactive label: `text-text-faint`.

## 3. Text hierarchy

| Token | Use for |
|---|---|
| `text-text-primary` | Headings, selected labels, primary values |
| `text-text-secondary` | Emphasized body, hovered labels, control glyphs |
| `text-text-tertiary` | Default body, resting labels |
| `text-text-faint` | De-emphasized hints, counters, disabled-looking marks, placeholders |

## 4. Migration rules (mechanical)

| Old pattern | New pattern |
|---|---|
| `bg-card` / `bg-panel-bg` / `bg-popover` (in these two areas) | `bg-surface-1` |
| `bg-panel-header-bg` / `bg-muted` | `bg-surface-2` |
| `hover:bg-muted(/NN)` / `bg-muted/NN` | `bg-surface-3` (or `surface-4` for pressed/inset wells) |
| `bg-background/NN` | the parent surface's tone |
| `text-muted-foreground` | `text-text-faint` (hints) or `text-text-tertiary` (body) — choose by emphasis |
| `text-foreground/NN`, `text-card-foreground/NN` | `text-text-secondary` or `text-text-tertiary` |
| `border-border` | `border-surface-border-subtle` (hairlines) or `border-surface-border` (outlines) |
| `border-border/NN` | `border-surface-border-subtle` |
| `ring-primary/40` focus rings on controls | `ring-surface-border-strong` |
| `disabled:bg-muted disabled:opacity-100` | `disabled:bg-surface-2 disabled:text-text-faint` |

**Opacity modifiers are banned on all neutral utilities** (`surface-*`, `text-text-*`,
`border-surface-*`, `background`, `foreground`). They remain allowed on accent colors
only (`success`, `destructive`, `warning`, `info`, `primary`) for tints such as
`bg-success/10 text-success`.

## 5. Accent policy (success / error / warning states)

Semantic colors live outside the ladder and come only from tokens — never Tailwind
palette classes (`emerald`, `rose`, `amber`, `green`, `red`, `yellow`, `blue`), never
per-element `dark:` variants for them (the token already has a dark value).

- Correct / success: `border-success bg-success/10 text-success` (subtle) or `bg-success text-success-foreground` (solid)
- Incorrect / destructive: same pattern with `destructive`
- Correct-answer letter circles: `border-success bg-success/10 text-success`; incorrect: `border-destructive bg-destructive/10 text-destructive`

`--success`, `--warning`, `--info` were placeholder grays; T0 replaces them with real
hues in `globals.css` (already done — see below).

## 6. Hard constraints for every agent

1. **Style-only.** No changes to logic, state, hooks, props, event handlers, data flow, or exports. The dialog↔viewer wiring (`useStudioDialogs`, `useGenerationStore`, `RightPane`) is untouched.
2. Only touch the files listed in your task. Other agents work on disjoint files in parallel.
3. No new CSS variables; the ladder tokens in `frontend/src/globals.css` are complete.
4. Do not "fix" pre-existing lint warnings (`exhaustive-deps`, `only-export-components`).
5. Verify with `cmd /c "cd /d frontend && pnpm run typecheck"` and `cmd /c "cd /d frontend && pnpm run lint"` — zero new errors/warnings vs. baseline.
6. Keep all existing `data-slot` attributes, aria attributes, and test-facing class hooks intact.

## 7. Verification sweep (final QA)

```
rg -n "muted|emerald|rose|amber|bg-black/|bg-white/|text-white/|foreground/\d|border/\d|#[0-9a-fA-F]{3,8}" <area files>
```
must return zero hits (accent-token opacity like `success/10` is fine).
