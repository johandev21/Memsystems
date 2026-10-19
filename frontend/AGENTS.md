# Frontend Agent Instructions (`frontend/`)

React 19 + Vite + TanStack Router & Query + Tailwind CSS v4.

## Mobile Redesign: Desktop is Frozen

Mobile changes must preserve the desktop (`sm:` and up) layout and visual design. Tailwind is mobile-first, so unprefixed utilities apply to desktop as well.

- **Scope mobile overrides with `max-sm:` (or `max-md:`)**: Write `max-sm:min-h-11` rather than an unprefixed `min-h-11` paired with `sm:h-8` (`sm:h-8` does not reset `min-h-11`).
- **Additive touch classes**: Use `touch-manipulation` and `active:scale-97` without altering shared desktop sizing, spacing, borders, or typography.
- **44px Panel Headers**: Every panel header in `/notebooks/$id` (chat, sources, source reader, studio, material viewer, and their skeletons) is fixed at 44px (`p-1.5` + `min-h-11`, children `h-8`), enforced by `panel-header-consistency.test.ts`. Enlarge hit areas with `max-sm:` only when the 44px header height is unchanged.
- **Diff check**: Before finishing mobile UI edits, run `git diff main` on modified files to verify that no unprefixed utility class was altered.

## Testing & i18n

- **No hardcoded UI copy**: Never hardcode user-facing strings (placeholders, tooltips, `aria-label`, buttons). Always register translation keys in both `locales/en/` and `locales/es/`, use `useTranslation()`, and run `pnpm --filter frontend i18n:types`.
- `src/test/setup.ts` preloads all English i18n namespaces so components do not suspend on `useTranslation` during synchronous queries. Preserve this preload.
- For test patterns and troubleshooting (`<body><div /></div>` or raw translation keys), read [../docs/testing.md](../docs/testing.md).
