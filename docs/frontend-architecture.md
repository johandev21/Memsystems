# Frontend Architecture

This document describes the architecture and engineering conventions for the `frontend/` package in `memsystems-ai`.

The frontend uses a **Feature-First** architecture designed for modularity, clean ownership, and alignment with standard tooling (Vite, React 19, TanStack Router, TanStack Query, shadcn/ui, Tailwind CSS).

---

## Directory Structure

```text
frontend/src/
├── app/                       # Application bootstrapping, routing & global providers
│   ├── app.tsx                # App root composing providers & router
│   ├── config/                # App-wide configuration & constants
│   ├── providers/             # Global React context providers
│   │   ├── query-provider.tsx
│   │   ├── auth-provider.tsx
│   │   ├── theme-provider.tsx
│   │   ├── use-theme-keyboard-shortcut.ts
│   │   └── index.ts
│   └── router/                # TanStack Router instance & route guards
│       ├── router.ts
│       └── guards.ts
│
├── components/                # Domain-neutral shared components
│   ├── ui/                    # shadcn UI primitives (button, dialog, card, input, etc.)
│   ├── layout/                # Generic shell layouts (app-header, user-menu, logo)
│   └── feedback/              # Generic status UI (empty-state, spinner, confirm-delete-dialog)
│
├── features/                  # Domain business modules
│   ├── auth/                  # Better Auth integration & session management
│   ├── ai/                    # AI prompt input, reasoning, model selector
│   ├── notebook-chat/         # Notebook chat panel, messages, streaming, history
│   ├── notebooks/             # Notebooks CRUD, cards, banners, workspace layouts
│   ├── sources/               # Source ingestion, upload forms, audio/document viewers
│   ├── study-material-generation/ # Study material generation dialogs & brief forms
│   ├── study-material-tree/   # Study material tree structure, folders, inline renames
│   ├── study-material-viewer/ # Study material interactive viewers (flashcards, quiz, mind map, roadmap)
│   └── theme/                 # Palette & theme switcher
│
├── pages/                     # Full-screen page views consumed by routes
│   ├── landing/
│   ├── login/
│   ├── home/
│   ├── notebooks/
│   └── settings/
│
├── routes/                    # TanStack Router file-based route tree
│   ├── __root.tsx
│   ├── index.tsx
│   ├── home.tsx
│   ├── login.tsx
│   ├── notebooks.index.tsx
│   ├── notebooks.$notebookId.tsx
│   └── settings.*.tsx
│
├── shared/                    # Truly domain-neutral utilities and base infrastructure
│   ├── api/                   # Base fetch client, query options factory, error handling
│   │   ├── api-client.ts
│   │   └── api-error.ts
│   ├── hooks/                 # General-purpose utility hooks
│   ├── utils/                 # cn, formatters
│   │   ├── cn.ts
│   │   └── format-title.ts
│   ├── types/                 # Universal types
│   └── constants/
│
├── assets/                    # Static assets, fonts, icons, SVGs
└── styles/                    # Global stylesheets (globals.css, tokens, themes)
```

---

## Dependency Direction & Rules

The project enforces a unidirectional dependency hierarchy:

```text
app
 ↓
pages
 ↓
features
 ↓
shared / components
```

### Allowed Imports
- `app` → `pages`, `features`, `components`, `shared`
- `pages` → `features`, `components`, `shared`
- `features` → `components`, `shared`
- `components` → `shared`

### Disallowed Imports
- `shared` / `components` **must never** import from `features`, `pages`, or `app`.
- `features` **must never** import from `pages` or `app`.
- **Feature-to-Feature cross imports are disallowed** (`feature A` → `feature B`). When multiple features must coordinate, the `page` or `app` layer composes them and passes props/callbacks down.

---

## Feature Structure

Each feature in `src/features/<feature-name>/` should adhere to this standard organization (only create folders as needed):

```text
features/<feature>/
├── components/                # Feature-specific UI components
├── hooks/                     # Feature-specific state and interaction hooks
├── api/                       # Feature endpoint calls, query options, and mutations
├── types/                     # Feature domain models and DTOs
├── utils/                     # Feature-specific pure helpers
├── schemas/                   # Zod validation schemas
└── index.ts                   # Public API barrel exporting only intentional interfaces
```

### Feature Public API
- Internal feature files can use relative imports within the feature.
- External code (pages, routes) must import from the feature root (`@/features/<feature>`).
- Keep feature barrels (`index.ts`) minimal: export only components, hooks, and types intended for external consumption.

---

## Component & File Responsibilities

1. **Clean JSX Presentation**:
   - Component `.tsx` files should read like high-level declarative UI.
   - Extract heavy data transforms, complex state orchestration, keyboard listeners, and event handlers to `.hooks.ts`, `.utils.ts`, or `.types.ts`.
2. **shadcn UI Convention**:
   - Generic UI primitives reside directly in `src/components/ui/`.
   - Domain-specific variants (e.g. `notebook-card.tsx`) belong in their respective feature's `components/` directory.
3. **API Layer**:
   - `shared/api/api-client.ts` owns base HTTP fetching, credentials, and error normalization.
   - Feature APIs (`features/<feature>/api/*.ts`) define endpoint URLs, query keys, request/response types, and query option builders.
