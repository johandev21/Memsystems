---
name: color-hierarchy
description: Build frontend UI with the neutral surface ladder — depth and hierarchy come from stepping through surface tones, not opacity or muted remixes. Use when creating or styling components, choosing background/border/text colors, building nested panels, cards, list rows, or any depth/elevation hierarchy in this app.
---

Depth in this app is a **ladder**: one neutral hue cut into five tones, where every nested surface steps exactly one tone above its parent. A card on the page is one step up; a row on the card is another; a selected row another. Hierarchy is read from tone distance alone — no shadows-for-depth, no opacity tricks, no `muted` remixes.

## Tokens

Defined in `frontend/src/globals.css` (`:root` light, `.dark` dark), mirrored into `@theme inline` so utilities like `bg-surface-2` and `text-text-faint` work.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--surface-0` | page white | page black | App background |
| `--surface-1` | | | Card / panel on the page |
| `--surface-2` | | | Element resting on a card (list row, input) |
| `--surface-3` | | | Active / selected / hovered element |
| `--surface-4` | | | Deepest inset or pressed state |
| `--surface-border-subtle` | | | Hairline between adjacent surfaces |
| `--surface-border` | | | Visible outline on cards and selected elements |
| `--surface-border-strong` | | | Interactive controls: circles, badges, inputs |
| `--text-primary` | | | Headings, primary content |
| `--text-secondary` | | | Emphasized body text |
| `--text-tertiary` | | | Default body text |
| `--text-faint` | | | De-emphasized labels, disabled-looking marks |

## Steps

1. **Count the nesting depth** from the page (`surface-0`) and give each layer the next tone. A modal on the page is `surface-1`; a row inside it is `surface-2`; its selected sibling is `surface-3`. Completion criterion: every surface in the component sits exactly one tone from its container, and two nested siblings never share a tone with different parents.

2. **Pick the border from the same ladder**, one step relative to the surface it outlines: `border-subtle` for a hairline separating adjacent surfaces, `border` for a visible card or selected outline, `border-strong` for small interactive controls (letter circles, badges, inputs). Completion criterion: no border in the component uses a tone outside these three tokens.

3. **Pair text by emphasis, not by opacity**: `text-primary` for headings, `text-tertiary` for default body, `text-faint` for de-emphasized marks. De-emphasis is a darker token in light mode and a dimmer token in dark mode — the token carries the meaning in both themes. Completion criterion: the component contains no opacity modifiers (`/50`, `/60`…) and no `muted` usage for grays.

## Rules

- Interactive states are ladder steps: rest = the element's base tone, hover/selected = one step up, pressed = one more. State changes move along the ladder, never jump off it.
- Grays come only from these tokens. When a design seems to need a tone between two steps, step to the nearest one; the ladder stays short on purpose.
- Accent colors (brand, chart, destructive, cta) live outside the ladder; the ladder is for structure and depth only.

## Failure modes these rules prevent

Each rule below exists because a real refactor hit it — treat a violation as a bug, not a style choice.

- **Structure never wears accents.** `--primary` is near-white in dark mode and dark in light mode, so `bg-primary` on a node, root pill, badge, or card inverts its theme. Structural elements (tree roots, active nodes, containers, dividers, status dots) step along the ladder; accents appear only where the design means *action* (CTAs, links, selection checks) or *outcome* (pass/fail, correct/incorrect).
- **Progress and position live on the ladder.** Progress bars, steppers, counters, and position indicators are structural state — their fills and tracks use ladder tones (`text-faint` fill on a `surface-4` track), never accent fills. A bright fill makes the quietest element on screen the loudest.
- **Steps must be perceptible.** Adjacent ladder steps differ visibly in both themes — if two nested surfaces look identical on screen, the nesting is wrong or a step was skipped; never compensate by inventing a tone or an opacity modifier.
- **`--text-faint` is the floor.** It is the dimmest text allowed and stays legible on `--surface-2`. Hints, counters, and placeholders use it; anything dimmer is a bug, and de-emphasis beyond it means the content is not a hint.
- **Restyle only what the task names.** A component embedded in a larger layout (a tree panel living inside the studio workspace, a row inside a shared list) keeps its existing tokens unless the task explicitly includes its host surface. Scope leaks show up as one panel drifting out of its siblings' design.
- **Headers use the app header recipe.** Any full-pane or dialog view header matches the app's standard header — same background token (`--panel-header-bg`), same height (`min-h-[44px]`), same typography (`text-sm font-semibold`) — so headers align across side-by-side panels. A view with its own header treatment reads as a different app.
- **One selected recipe, one focus recipe.** Selection = tone step + `surface-border` + text weight. Keyboard focus = `focus-visible:ring-2 ring-surface-border-strong`. The two never blend: a focused-but-unselected control shows only the ring, and no control falls back to the browser's default focus outline.
