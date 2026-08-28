# Frontend Readable React Refactor Plan

## Plan metadata

- Audited repository: `memsystems-ai`
- Audited commit: `06528a45943674231a35c3fd5b194f22e13a8dbf`
- Prepared: 2026-08-27
- Governing standard: `readable-react`
- Placement constraints: repository FSD v2.1 conventions plus the `feature-sliced-design` placement rules
- Intended consumer: an implementation agent working from this commit or explicitly re-auditing drift

## Outcome

Refactor the frontend so each main React component reads as a high-level description of its UI and behavior. Move implementation details into small, semantically named components, helpers, and cohesive hooks only when doing so makes that outline easier to understand.

This is a behavior-preserving readability refactor. It is not a redesign, API rewrite, state-management migration, or general FSD cleanup.

## Scope and non-goals

### In scope

- Production React files under `frontend/src`.
- Characterization tests needed to make high-risk structural refactors safe.
- Removing the confirmed unreachable legacy study-materials tree after a final inbound-reference check.
- Correcting an import boundary when a touched file already bypasses an existing public barrel.
- Small dead-code removal when it is local, proven unused, and directly obscures the component outline.

### Out of scope

- Visual redesigns, class-name normalization, spacing changes, animation changes, or copy changes.
- Backend, API contract, database, schema, or generated route changes.
- A repository-wide FSD remediation. Existing Steiger failures are a recorded baseline.
- Replacing TanStack Query, Zustand, React Router, shadcn/Base UI primitives, or feature public APIs.
- Extracting code merely to reduce line count.
- Creating generic config-driven forms, mega-components, render-prop frameworks, or speculative shared abstractions.
- Refactoring unreferenced prototypes whose product intent is uncertain; leave them untouched unless the retention decision is made explicitly.

## Baseline

The worktree was clean at the audited commit.

| Check | Baseline |
|---|---|
| Production `.tsx` files, excluding tests | 143 |
| Production TSX lines | 20,911 |
| Files over 150 lines | 50 |
| Files over 250 lines | 26 |
| Files over 400 lines | 12 |
| `pnpm --filter frontend run lint` | Passes with 31 warnings |
| `pnpm --filter frontend run typecheck` | Passes |
| `pnpm --filter frontend run test` | 11 files, 47 tests pass |
| `pnpm --filter frontend run lint:fsd` | Fails at baseline with 19 errors and 6 warnings |

Important baseline warnings include mixed component/helper exports, exhaustive-dependency warnings in generation forms and quiz code, and Fast Refresh warnings. Do not silently mix behavior-changing hook dependency fixes into structural refactors. Characterize the behavior first and handle any dependency fix in a separate, clearly named change.

The Steiger baseline includes cross-feature imports and public-API sidesteps that predate this plan. Every packet must introduce no new Steiger findings. When a touched file has a directly related sidestep, fix only that sidestep and verify the finding count does not increase.

## Mandatory Readable React contract

Every implementation packet must satisfy all of these rules:

1. After imports and the minimum public prop types needed to understand the API, the primary exported component appears first.
2. The primary component reads as an outline made from semantic UI names such as `SourcesList`, `QuizActions`, or `EmptyNotebookState`.
3. Internal components and helpers follow the primary component in importance order. A compound component-family file with no single primary component may retain its coherent public API order.
4. Hooks stay at the top of their component. Extract a custom hook only for a cohesive group of related hooks, effects, handlers, and derived values that materially obscures the outline.
5. Multi-step event logic lives in named handlers. A one-line value adapter such as `onChange={(event) => onChange(event.target.value)}` may remain inline.
6. Formatting, filtering, grouping, class derivation, and business decisions stay out of the main JSX.
7. A `.map()` is acceptable inside a named list component when each iteration renders a semantic child. It should not also contain transformations, branch logic, styling decisions, and event workflows.
8. Extract loading, empty, error, unauthorized, and recovery branches when naming the branch makes the parent easier to scan. Preserve concise early returns that are already clear.
9. Extract for semantic clarity, not line count. Do not move a clear one-use fragment into another file without a readability gain.
10. Keep props flat and focused. If an extraction needs five or more unrelated props, a controller-sized prop bag, or a generic options object, reconsider the boundary and leave cohesive code together.
11. Prefer a static lookup for stable state-to-class or kind-to-component mappings. Prefer a plain ternary when it is the clearest expression.
12. Use domain names. Avoid `renderThing`, `inner`, `contentNode`, `FooComponent`, technical `helpers.ts` buckets, and vague option-driven abstractions.
13. Preserve public exports, DOM semantics, ARIA attributes, `data-slot` values, keyboard ordering, CSS class strings, and animation timing unless a separately approved behavior fix requires a change.
14. End each packet with a brief “What changed & why” containing only the semantic extractions/removals and their readability benefit.

## FSD placement rules for this refactor

- Route files stay thin. Page-specific landing UI belongs in a page slice, not `routes/`.
- Single-page UI stays in its page slice. Duplication across pages is acceptable when sharing would create a weaker abstraction.
- Feature-specific hooks, helpers, and UI stay in their existing feature slice.
- Add something to `shared/` only when it is genuinely generic infrastructure with no business behavior.
- Cross-feature imports must use the target feature barrel. Internal imports within one feature should be relative rather than self-importing through the feature barrel.
- Preserve layer direction: app → pages → widgets → features → entities → shared.
- Serialize edits to `features/*/index.ts` barrels so parallel agents do not conflict.
- Never edit `frontend/src/routeTree.gen.ts`.

## Implementation protocol

For every packet:

1. Confirm `git rev-parse HEAD` and `git status --short`. If HEAD differs from the audited commit, inspect the diff in every target before applying this plan.
2. Run the existing targeted tests and add missing characterization tests before changing high-risk logic.
3. Refactor one semantic seam at a time while keeping public contracts stable.
4. Run the targeted test after each seam.
5. Run the frontend checks in this order: lint, typecheck, test, then Steiger comparison.
6. Exercise the packet’s browser smoke cases at desktop and mobile widths where applicable.
7. Review the diff for accidental CSS, copy, ARIA, event-order, and export changes.
8. Write the skill-required “What changed & why.”

Do not run a repository-wide formatter. Format only touched files, and review its diff.

## Dependency and parallelization map

| Lane | Can start after | Must complete before |
|---|---|---|
| Shell/pages | Baseline capture | Final browser pass |
| AI primitives | Prompt-input characterization tests | Notebook-chat composer/chat; source code viewer |
| Notebook banner | Banner characterization tests | Notebook card preview |
| Source ingestion/search | Store/timer characterization tests | Final source workflow smoke pass |
| Generation primitives | Generation characterization tests | Individual generation forms |
| Generation forms | Shared source/model picker contracts | `GenerateBriefDialog` |
| Study viewers | Viewer characterization tests | `MaterialViewer` |
| Production tree model | Legacy deletion decision and tree tests | Tree controller/UI |
| Production tree UI | Adapter/controller contracts stable | Final workspace smoke pass |

Parallel agents must own disjoint files. One designated owner handles each shared extraction and each barrel. Do not have multiple agents independently invent source/model picker, focal-drag, prompt-input, or tree-controller abstractions.

---

## Packet 0 — Lock behavior and remove confirmed waste

### 0.1 Reconfirm the baseline

- [ ] Verify the audited commit or document drift.
- [ ] Run the four frontend baseline commands and record counts.
- [ ] Keep the existing 31 lint warnings and 19/6 Steiger findings visible; do not claim they were introduced by this work.

### 0.2 Add characterization coverage before high-risk edits

Create focused tests beside the target modules. Prefer behavior-level tests over snapshots.

- [ ] `features/ai/ui/prompt-input.test.tsx`: local/provider attachments, add/remove/clear, URL cleanup, accept/size/count limits, scoped/global drop, rejected submit retention, Enter/Shift+Enter/IME, paste, screenshot cancellation, and submit/stop states.
- [ ] `pages/settings/ui/settings-page.test.tsx`: provider add/replace/delete, invalid format, clipboard failure, query invalidation, and theme selection.
- [ ] `pages/notebooks/ui/notebooks-page.test.tsx`: loading/empty/results, search/clear, visible-page gaps, navigation, creation success/error.
- [ ] Banner tests: edit event scoping, cancel/reset, focal clamping, upload/remove, preview URL cleanup, patch payload, cache invalidation, and error fallback.
- [ ] Source tests: optimistic pending lifecycle, timer cleanup, every add mode, search fallback/import statuses, source reader states/fullscreen/download.
- [ ] Generation tests described in Packet 5.
- [ ] Viewer tests described in Packet 6.
- [ ] Tree tests described in Packet 7.

### 0.3 Delete the confirmed unreachable legacy study-materials tree

Before deleting, run an inbound-reference search at the current HEAD. If these files remain reachable from production code, stop this deletion and update the plan.

Delete the unreachable chain:

- `features/study-materials/components/tree/study-materials-tree.tsx`
- `features/study-materials/components/tree/tree-node.tsx`
- `features/study-materials/components/tree/study-materials-tree-helpers.ts`
- `features/study-materials/components/tree/resource-icons.ts`
- `features/study-materials/components/tree/expanded-study-materials.tsx`
- `features/study-materials/components/tree/mobile-expanded-study-materials.tsx`
- `features/study-materials/components/tree/study-materials-empty-state.tsx`

Keep the active wrappers:

- `features/study-materials/components/tree/study-materials-panel.tsx`
- `features/study-materials/components/tree/mobile-study-materials-panel.tsx`

In the same atomic change:

- Remove obsolete wrapper props `open`, `onOpenChange`, and `selectedMaterialId`.
- Remove the matching arguments in desktop/mobile workspace layouts.
- Remove obsolete `studyMaterialsDialogOpen` state and setter from `features/notebooks/hooks/use-studio-dialogs.ts`.
- Preserve and run `panel-host-composition.test.tsx` plus every current `components/study-materials-tree/**` test.

Do not refactor the unreferenced Flashcard variants, prototype adapter, or inert roadmap progress hook. Their product-retention decision is less certain; leave them as explicit decision gates for a separate cleanup.

---

## Packet 1 — Application shell and pages

### 1.1 Landing route and page — highest priority

Targets:

- `frontend/src/routes/index.tsx:84-639`
- New page slice under `frontend/src/pages/landing/`

Current problem:

- Route configuration, page UI, data, motion helpers, and FAQ state all share a 639-line route file.
- Four supporting components precede `LandingPage`, which starts at line 235.
- The main JSX includes navigation, mobile drawer, five page sections, nested maps, and inline menu logic.

Plan:

- [ ] Move `LandingPage` into `pages/landing/ui/landing-page.tsx` and export it from `pages/landing/index.ts`.
- [ ] Leave `routes/index.tsx` as route registration importing `LandingPage` from the page barrel.
- [ ] Put `LandingPage` first and make its return read: `LandingNavigation` → `LandingHero` → `BenefitsSection` → `WorkflowSection` → `FaqSection` → `FinalCallToAction` → `LandingFooter`.
- [ ] Keep those substantial, page-local sections below the main component. Split a section into a sibling file only when it has an independently understandable contract with four or fewer meaningful props.
- [ ] Name `handleMenuToggle`, `handleMenuClose`, and FAQ selection logic.
- [ ] Move mobile link data and motion transition lookup out of JSX.
- [ ] Keep `RevealWord` and the simple word-list map; move range derivation to a named helper or named word-list child.

Verification:

- Render, mobile menu open/close/link close, FAQ single-toggle behavior, login links, skip link, and reduced-motion behavior.
- Confirm the route Fast Refresh warnings no longer come from page components embedded in the route module.

### 1.2 Settings page — highest priority

Target: `frontend/src/pages/settings/ui/settings-page.tsx:79-495`

Current problem:

- `SettingsPage` is last at line 386.
- `ProviderRow` owns eight state values, connection state, mutations, clipboard behavior, two dialogs, and a 164-line JSX tree.
- The page retains unused query/test handlers at lines 388-407.
- Theme options are constructed and transformed inside JSX at lines 468-488.

Plan:

- [ ] Put `SettingsPage` first and reduce it to `AppHeader`, `SettingsHeader`, `ProviderSettings`, `SecurityNotice`, and `ThemeSelector`.
- [ ] Remove the proven-unused `_isPending`, `_testing`, `_handleRefresh`, and `_handleTestAll` block; do not change live provider polling.
- [ ] Move the provider editor into page-local `ui/provider-key-row.tsx`.
- [ ] Extract a cohesive page-local `model/provider-key-editor.ts` hook only for provider-key draft lifecycle, save/remove, clipboard, transient confirmation state, and query invalidation.
- [ ] Keep the row outline semantic: `ProviderIdentity` → `ProviderKeyField` → `ProviderKeyActions` → `ProviderKeyDialogs`.
- [ ] Name replace, visibility, delete-dialog, input-change, and confirmed-delete handlers.
- [ ] Use a static theme option list and a `ThemeOption` child; do not create a generic segmented-control component.

Guardrail: if the proposed row children require a large editor prop bag, keep the cohesive markup in `ProviderKeyRow` and extract only the state branch or handler that improves the outline.

### 1.3 All notebooks page

Target: `frontend/src/pages/notebooks/ui/notebooks-page.tsx:18-230`

Plan:

- [ ] Keep `NotebooksPage` first.
- [ ] Move page-number derivation into `getVisiblePages`.
- [ ] Make the outline read `NotebooksHeader` → `NotebookSearch` → `NotebooksContent` → optional `NotebookPagination`.
- [ ] Name `handleSearchKeyDown`, `handleClearSearch`, previous/next navigation, and page selection.
- [ ] In `NotebooksContent`, name `NotebooksLoadingState`, `NotebooksEmptyState`, and `NotebookGrid`; keep card mapping inside `NotebookGrid`.
- [ ] Keep these components page-local. Do not move them to `shared/` merely because the home page has similar markup.

### 1.4 Notebook workspace layouts

Targets:

- `widgets/notebook-workspace/ui/desktop-layout.tsx:41-255`
- `widgets/notebook-workspace/ui/mobile-notebook-layout.tsx:18-137`

Desktop plan:

- [ ] Extract the cohesive resize observation into `useResponsiveChatMinimum`.
- [ ] Make the main panel group read as `SourcesWorkspacePanel` → handle → `ChatWorkspacePanel` → handle → `StudioWorkspacePanel`.
- [ ] Keep panel sizing and review-mode rules visible near the panel that owns them.
- [ ] Name source-close and study-material mode-change handlers.
- [ ] Extract a repeated `WorkspaceResizeHandle` only if its disabled behavior remains obvious.

Mobile plan:

- [ ] Extract `useMobileChatNavigation` and `useMobileOverlayScrollLock`.
- [ ] Name source close and study-material mode-change handlers.
- [ ] Name `MobileWorkspaceTabs` and `MobileViewerOverlays` only if each can keep a focused prop surface.

Guardrail: do not “clean up” the existing layout by passing one opaque workspace object or a ten-property controller to every child.

### 1.5 Focused shell cleanups

- `shared/ui/icon-picker.tsx:166-458`: put `IconPicker` before `IconItem`; extract pure search/catalog derivation, name clear-search, and use semantic `IconSearch`, `IconCatalog`, `IconGrid`, and `EmptyIconResults` only where props remain focused. Add keyboard/debounce/infinite-scroll tests.
- `pages/home/ui/notebooks-section.tsx:17-132`: put the main first; use `RecentNotebooksContent`, named loading/empty/grid branches, and keep `formatUpdatedAt` below. Keep the implementation local despite similarity with the all-notebooks page.
- `shared/ui/layout/editable-notebook-title.tsx:7-99`: name edit, cancel, input, and keyboard handlers; extract a cohesive edit hook only if it improves the two-state outline. Test Enter, Escape, blur, unchanged/empty values, mutation success, and rollback.
- `app/providers/index.tsx:6-83`: move `AppProviders` before internal shortcut/query-client helpers. Keep those helpers cohesive.
- `pages/login/ui/login-page.tsx:7-64`: move `LoginPage` before `GoogleIcon`; no further extraction.
- `shared/ui/confirm-delete-dialog.tsx:40-43`: replace the multi-statement inline click handler with `handleConfirm`.

---

## Packet 2 — AI component platform

### 2.1 Prompt input — highest risk and highest value

Target: `frontend/src/features/ai/ui/prompt-input.tsx:54-1205`

Current problem:

- The primary `PromptInput` begins at line 417.
- Attachment ownership, object URLs, validation, form/global drop listeners, screenshot capture, async submit conversion, textarea interaction, contexts, and dozens of compound primitives share one module.
- File validation is duplicated, and JSX fragments are named `inner` and `withReferencedSources`.

Plan:

- [ ] Preserve every public export and the `features/ai` barrel contract.
- [ ] Add internal `hooks/use-prompt-input-files.ts` for local/provider attachment ownership and cleanup.
- [ ] Add internal `hooks/use-prompt-input-drop-target.ts` for scoped and global drag/drop listeners.
- [ ] Add feature-local `lib/prompt-input-files.ts` with `validateIncomingFiles`, `createFileParts`, and `convertFilePartsForSubmit`.
- [ ] Move screenshot/blob conversion into a feature-local domain-named helper module.
- [ ] Put `PromptInput` first among the primary form API and make the form outline use `PromptInputFileInput` and `PromptInputContextProviders`.
- [ ] Remove vague JSX variables in favor of named components.
- [ ] Split textarea interactions into their own cohesive module only if the first extraction still leaves the public file without a readable outline.
- [ ] Deduplicate tooltip text derivation while preserving the thin compound-control aliases.

Do not collapse or remove small exported compound primitives. They form an intentional consumer vocabulary.

### 2.2 Code block

Target: `features/ai/ui/code-block.tsx:18-441`

- [ ] Move tokenization, cache/subscriber behavior, and `highlightCode` into `features/ai/lib/code-highlighting.ts`.
- [ ] Preserve and re-export `highlightCode` through the existing public API.
- [ ] Put public `CodeBlock` before `CodeBlockContent` and `CodeBlockBody`.
- [ ] Test unknown-language fallback, stale async results, line numbers, copy state, and timeout cleanup.

Complete this before refactoring source code/markdown readers.

### 2.3 Focused AI lifecycle components

- `ui/reasoning.tsx:49-131`: extract `useReasoningLifecycle`; preserve the compound API. Add fake-timer coverage for controlled/uncontrolled open state, stream-open, auto-close, manual close, and duration.
- `ui/openai-key-prompt.tsx:17-175`: use `ProviderPromptHeader`, `ProviderSettingsState`, `ProviderKeyForm`, and `ProviderPromptFooter`; keep connection mutation in a focused hook owned by the form.
- `ui/markdown-code-block.tsx:20-67`: put the main component before `getRawText`; keep clear inline/block branches inline.

No-refactor AI files are listed in the exclusions section.

---

## Packet 3 — Notebook chat after PromptInput stabilizes

### 3.1 Assistant message

Target: `features/notebook-chat/components/assistant-message.tsx:26-125`

- [ ] Put `AssistantMessage` first.
- [ ] Extract `useAssistantMessageContent`, `AssistantReasoning`, `AssistantResponses`, and `EmptyAssistantMessage`.
- [ ] Keep citation/reference behavior and current citation tests unchanged.
- [ ] Add reasoning-only, empty, multiple text-part, residual-reference, and streaming cases.
- [ ] Audit unused `onCopy`, `onRegenerate`, and `showRegenerate` publicly before removing them; do not silently shrink the contract.

### 3.2 Composer

Target: `features/notebook-chat/components/composer.tsx:46-195`

- [ ] Keep the main outline as textarea → model picker → submit.
- [ ] Add local `ComposerModelPicker`, `ModelGroup`, and `ModelOption`.
- [ ] Extract pure `normalizeModels`, `filterModels`, `groupModels`, and `getProviderName`.
- [ ] Preserve existing submit/stop tests and add search, grouping, current model, selection/close, and malformed model payload cases.

### 3.3 Chat panel

Target: `features/notebook-chat/components/chat-panel.tsx:16-182`

- [ ] Move clear-history ownership into the existing `useChatPanel` only if it is part of the same cohesive state machine.
- [ ] Extract local `useComposerHeight`.
- [ ] Name clear-dialog callbacks and key-prompt provider/description derivation.
- [ ] Do not pass the full 22-field hook result to a new child.
- [ ] Extend hook coverage for visible/hidden panels and add ResizeObserver/composer-height behavior.

### 3.4 Small chat cleanups

- `clear-history-dialog.tsx:21-58`: named confirmed-clear handler.
- `user-message.tsx:4-22`: main first; derive text parts before JSX so the list does not branch per item.

---

## Packet 4 — Notebooks and sources

### 4.1 Shared banner interaction, then banner/card

Targets:

- `features/notebooks/components/shared/notebook-banner.tsx:27-376`
- `features/notebooks/components/shared/notebook-card-preview.tsx:26-214`

Plan:

- [ ] Extract `useBannerFocalPointDrag` in the notebooks slice from the duplicated, currently used drag behavior.
- [ ] Characterize pointer coordinates and clamping before sharing it.
- [ ] Extract `useNotebookBannerEditor` for draft lifecycle, object URLs, save/upload/remove, cache invalidation, and scoped edit events.
- [ ] Keep `NotebookBanner` first and make it read banner media → notebook identity/description → edit actions → upload dialog.
- [ ] Use local `BannerImage` and `BannerEditActions`; extract identity only if its prop surface stays small.
- [ ] Reuse the focal hook in the card preview, then name `BannerPreviewMedia` and `BannerPreviewActions`.

### 4.2 Source ingestion dialog

Target: `features/sources/components/add-source-dialog.tsx:34-338`

- [ ] Characterize optimistic store rows, fake progress timers, cleanup delays, abort/error handling, and query invalidation.
- [ ] Extract `useAddSourceDialogState` for mode/field/reset behavior.
- [ ] Add `features/sources/model/source-upload-actions.ts` with separate `startUrlUpload`, `startFileUpload`, and `startTextUpload`.
- [ ] Share only small completion/error lifecycle helpers; do not create one config-driven uploader.
- [ ] Add local `SourceLimitMeter`.
- [ ] Keep existing `FileUploadMode`, `UrlInputMode`, and `TextInputMode` as the main UI outline.

### 4.3 Web search composer

Target: `features/sources/components/web-search-composer.tsx:22-324`

- [ ] Extract local `useWebSearchModel`.
- [ ] Make the outline: capability warning → `WebSearchForm` → model-switch notice → `WebSearchFeedback` → `WebSearchResults`.
- [ ] Use `WebSearchCandidateRow` and `WebSearchResultActions` so result mapping contains no transform/branch/action workflow.
- [ ] Add pure `getImportStatusText`; keep `getHostname` below the main.
- [ ] Test no-capable-model, persisted supported/unsupported model, keyboard submit, searching/error/empty, candidate selection, every import result, retry, import, and clear.

### 4.4 Source readers and panel

- `source-content-viewer.tsx:39-277`: put main first; extract `useSourceReaderControls`, `SourceReaderLoading`, `SourceReaderError`, `SourceReaderHeader`, and `SourceDocument`; replace JSX variables with semantic components.
- `renderers/article-document-viewer.tsx:86-162`: put main first; share `ArticleBlockView` between virtual/static branches; keep parsing below.
- `renderers/markdown-document-viewer.tsx:13-158`: put main first; name `VirtualizedMarkdownDocument`; keep the renderer map.
- `sources-panel.tsx:18-180`: add a named `SourcesList` state boundary and named delete-dialog handlers.
- `file-upload-mode.tsx:16-155`: main before validator; name drag-enter and open-dialog handlers.
- `text-input-mode.tsx` and `url-input-mode.tsx`: name form submit handlers; leave one-line field adapters inline.

When touching `renderers/code-document-viewer.tsx`, replace the deep cross-feature import with `@/features/ai`. Do not otherwise refactor that already-focused file.

### 4.5 Remaining notebook components

- `image-upload-dialog.tsx:23-162`: main first; `BannerImageDropzone` owns named drag/click/keyboard/input handlers; resize helper below.
- `notebook-settings-dialog.tsx:34-133`: `NotebookActionsMenu`, `DeleteNotebookDialog`, and named edit/clear/delete handlers.
- `notebook-description.tsx:13-106`: `useDescriptionOverflow`, `DescriptionEditor`, and `DescriptionText`.
- `studio-resources.tsx:63-196`: `CollapsedResourceList`, `ResourceGrid`, `ResourceButton`, `ActiveGenerationList`, `ActiveGenerationCard`, and `getGenerationSubtitle`.
- `studio/right-pane.tsx:17-101`: rename mechanical wrapper to `StudyMaterialPane`; name select/loading/error states; audit unused `notebookId` before any contract change.

---

## Packet 5 — Study-material generation

### 5.1 Lock form behavior

Before extraction, tests must preserve:

- Default synchronization timing in Quiz, Flashcard, Roadmap, and Mind Map forms.
- Exact partial reset after dialog submission.
- Submission allowed when trimmed instructions or at least one source exists.
- Per-form clamp and invalid-value fallbacks.
- Filtered select-all retaining selected off-filter sources.
- Quiz wizard state when moving forward, backward, or through the step bar.
- Mind Map’s fixed hierarchical payload.
- Runtime fallback from the form dispatcher.

Add coverage for `GenerateBriefDialog`, the dispatcher, source/model pickers, and each form’s distinct payload.

### 5.2 One owner extracts only genuine picker duplication

Add under `features/study-materials/components/generation/forms/`:

- `generation-source-popover.tsx`
- `generation-model-popover.tsx`

`GenerationSourcePopover` initially serves Quiz, Flashcard, and Roadmap with four flat props: sources, selected IDs, change callback, and empty message. Its outline should be trigger → search header → source list → selection count. Keep Mind Map local if joining requires labels/config bundles.

`GenerationModelPopover` initially serves Quiz, Flashcard, and Standard. Keep Roadmap/Mind Map local if their differing interaction contracts would require variants or config inflation.

Do not replace `MATERIAL_FORM_MAP`; it is already the correct static lookup pattern.

### 5.3 Refactor forms independently after picker contracts land

`QuizBriefForm.tsx:53-607`

- Replace `renderStepOne` and `renderStepTwo` with `QuizSourcesField`, `QuizInstructionsField`, `NextStepAction`, and `QuizSubmitActions`.
- Redesign eight-prop `QuestionSelector` as `QuestionCountSelector` around one count value and one change callback.
- Keep existing `DifficultySelector`.

`FlashcardBriefForm.tsx:54-541`

- Add `CardStyleSelector`, `FlashcardDifficultySelector`, `CardCountSelector`, and `FlashcardSourcesField`.
- Make count selection one value/one callback and name count handlers.

`RoadmapBriefForm.tsx:59-496`

- Add `RoadmapPhaseSelector`, `RoadmapDetailSelector`, and `getPhaseLabel`.
- Name automatic, preset, and custom phase handlers.
- Add `useRoadmapOptions` only if the cohesive state/effect block materially sharpens the main outline.

`MindMapBriefForm.tsx:37-412`

- Add `MindMapSizeSelector` and `getMapSizeLabel`.
- Name automatic, preset, and custom size handlers.
- Preserve fixed structure/color/cross-link payload values.

### 5.4 Dialog last

Target: `GenerateBriefDialog.tsx:33-153`

- [ ] Refactor only after form contracts stabilize.
- [ ] Extract cohesive `useGenerationBriefState`, named `handleFormChange`, and `getGenerateDialogClassName`.
- [ ] Preserve render-time model reconciliation unless a separate, tested behavior change moves it.
- [ ] Preserve the exact partial reset; do not “clean up” additional fields.
- [ ] Keep the already-semantic `BriefForm` / `OpenAIKeyPrompt` branch.

---

## Packet 6 — Study-material viewers

### 6.1 Quiz viewer — highest priority

Target: `viewer/QuizView.tsx:306-755`

- [ ] Put `QuizView` first.
- [ ] Extract cohesive `useQuizSession` and `useQuizKeyboardShortcuts`.
- [ ] Name `EmptyQuizState`, `QuizProgress`, `QuizOptionList`, `QuizOption`, and `QuizActions`.
- [ ] Use an option-state union plus a static class lookup; do not return styled JSX nodes from helpers.
- [ ] Keep existing score, completion, stepper, and unanswered-dialog components.
- [ ] Remove duplicated active/review shells only through a small semantic component, not a mode-config mega-component.

Characterize empty quiz, selection lock, option states, modifiers/input exclusion, unanswered jump/submit, review, retake, and explain-chat event.

### 6.2 Flashcard viewer

Target: `viewer/FlashcardView.tsx:44-381`

- [ ] Make the main deck outline `FlashcardStage` → `FlashcardNavigation` with `SwipeRatingBadge`.
- [ ] Add `FlashcardFront` and `FlashcardBack`; remove `renderCard*` helpers.
- [ ] Move related keyboard/interaction state to one cohesive hook.
- [ ] Name drag and click handlers.
- [ ] Preserve flip/navigation, input exclusion, swipe thresholds, rating delay, cloze auto-advance, chat events, and persisted progress.

### 6.3 Mind map

Target: `viewer/MindMapView.tsx:65-423`

- [ ] Put `MindMapView` first.
- [ ] Add cohesive `useMindMapFlow`, `EmptyMindMap`, `MindMapCanvas`, and `MindMapControls`.
- [ ] Name node-click, init, and zoom handlers.
- [ ] Keep `createTree` and `buildGraph` as pure named helpers.
- [ ] Characterize empty/disconnected graphs, cycle protection, selection/collapse, chat dispatch, viewport timers, mobile layout, and controls.

### 6.4 Supporting viewers

- `MaterialViewer.tsx:37-185`: do last; use `useMaterialViewerFullscreen`, `MaterialContent`, `ViewerHeader`, named fullscreen/close handlers, and relative same-feature imports.
- `RoadmapView.tsx:54-324`: put main first and add only `RoadmapPhaseSection`; keep existing focused cards/header.
- `ClozeInteractive.tsx:54-100`: named input/key handlers and `ClozeFeedback`.
- `useFlashcardProgress.ts:14-55`: pure load/save helpers; retain navigation/rating in the hook.
- `use-generation-store.ts:50-198`: named lifecycle/state helpers and focused stream consumer while preserving the exported Zustand API.

Do not normalize the viewer content types against schemas during this pass; their shapes are not identical and that would be a behavior/API change.

---

## Packet 7 — Current production study-materials tree

The current implementation is `features/study-materials/components/study-materials-tree/**`. Do not edit the deleted legacy path by mistake.

### 7.1 Model and adapter first

- `model/use-expanded.ts:37-133`: add pure `getActiveFolderIds`, `getInitialExpandedIds`, and `reconcileExpandedIds`; preserve persistence timing.
- `model/production-adapter.ts:55-325`: keep the hook first; delegate the switch to named command-specific executors for create, rename, delete, duplicate, and move.
- Canonicalize `StudyMaterialsTreeSize` from its duplicate definitions.
- Share the duplicated tree-icon lookup between row and drag preview.

### 7.2 Controller without a public rewrite

Target: `ui/controller.tsx:123-688`

- [ ] Preserve the public `TreeController` shape for the first pass.
- [ ] Compose `useControllableFolderExpansion`, `useTreeFocusRegistry`, and `usePendingTreeCommands`.
- [ ] Add one named pending-command runner and `treeContainsItem`.
- [ ] Keep keyboard behavior cohesive if extracting it would scatter one state machine.
- [ ] Do not combine dependency-warning fixes with the first structural move unless tests prove identical ordering.

### 7.3 Row, root, and container

- `ui/tree/row.tsx:54-308`: extract cohesive row DnD/interaction logic plus `TreeRowDragHandle`, `TreeRowLabel`, and mobile `TreeRowActions`; preserve desktop `RowMenu`.
- `ui/study-materials-tree.tsx:70-251`: add `useTreeSelection`, `TreeRootMenu`, `TreeContent`, `TreeEmptyState`, and `DeleteTreeItemDialog`.
- `ui/study-materials-tree-container.tsx:20-112`: static content-height lookup, `TreeUpdatingIndicator`, `TreeRefreshError`, and named panel-toggle handler.
- `ui/tree/inline-rename.tsx:29-44`: named blur/key handlers.

Preserve the current tree tests and add:

- Arrow/Home/End/Left/Right/F2 navigation.
- Controlled versus uncontrolled selection and expansion.
- Valid/invalid/root DnD, 550 ms hover expansion, and cancellation.
- Coarse-pointer drag-handle behavior.
- Optimistic duplicate/delete/move success and rollback.
- Unknown-ID fallbacks and pending-command de-duplication.

Preserve all `data-slot`, ARIA, focus, pointer, context-menu, and event-propagation behavior.

---

## Packet 8 — Focused final cleanups

Apply only after the high-risk contracts are stable:

- Main-first reorder in `ai/ui/markdown-code-block.tsx`, article/markdown readers, app providers, login, and Roadmap.
- Named handlers in clear-history, confirm-delete, text/url input, cloze, inline rename, and editable title.
- Remove obsolete comments that merely narrate now-semantic JSX; keep comments that explain behavior constraints.
- Narrow touched barrels only after verifying all external imports.
- Re-run the inline-handler and JSX-transform searches, then inspect each match manually. Do not mechanically eliminate clear one-line adapters.

---

## Explicit exclusions and patterns to preserve

### Generated and adapter-style files

- Never edit `frontend/src/routeTree.gen.ts`.
- Do not split shadcn/Base UI adapter families based on line count: `alert-dialog`, `avatar`, `badge`, `button`, `button-group`, `card`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `dropdown-menu`, `hover-card`, `input`, `input-group`, `popover`, `resizable`, `scroll-area`, `select`, `separator`, `skeleton`, `spinner`, `tabs`, `textarea`, `tooltip`, and `typography`.

### Already-readable feature files

Keep as-is unless a named dependency in a packet requires a surgical import update:

- AI: `conversation.tsx`, `message.tsx`, `model-selector.tsx`, `shimmer.tsx`, `sources.tsx`.
- Notebook chat: `chat-empty-state.tsx`, `chat-message-list.tsx`, `chat-panel-header.tsx`, `reference-popover.tsx`.
- Notebooks: `model-selector.tsx`, `folder-picker.tsx`, `source-multi-select.tsx`.
- Sources: `code-document-viewer.tsx`, `pending-upload-row.tsx`, `plain-text-document-viewer.tsx`, `virtualized-document-container.tsx`.
- Study generation: `BriefForm.tsx`, `forms/index.tsx`, `option-row.tsx`, `types.ts`, and `StandardBriefForm.tsx` except its shared model-picker import.
- Study model/static files: editor schemas, shape files, kind labels, card detector, roadmap CSS, tree commands/tree model, tree error/skeleton, branch, header, row menu, and CVA variants.

Preserve existing semantic mapped children such as `MessageBubble`, `ModelRow`, `FolderNode`, `FolderRow`, `SourceRow`, and `ReferencePopover`.

### Decision gates, not refactor targets

- `viewer/variants/FlashcardVariantA.tsx`
- `viewer/variants/FlashcardVariantB.tsx`
- `viewer/variants/FlashcardVariantC.tsx`
- `study-materials-tree/model/adapter.ts`
- `viewer/useRoadmapProgress.ts`
- Prototype-only `lastAction`, `onInternalStateChange`, and `isPrototype` plumbing

Confirm product intent in a separate cleanup before deleting or reviving these.

## Verification matrix

### Per packet

Run in order:

1. Targeted Vitest file(s).
2. `pnpm --filter frontend run lint`
3. `pnpm --filter frontend run typecheck`
4. `pnpm --filter frontend run test`
5. `pnpm --filter frontend run lint:fsd` and compare against the 19-error/6-warning baseline.

Lint must not add warnings. Steiger must add no findings; touched, directly related sidesteps should decrease the baseline where possible.

### Browser smoke matrix

| Area | Required checks |
|---|---|
| Landing | Desktop/mobile navigation, drawer close, FAQ toggle, links, reduced motion |
| Home/notebooks | Loading, empty, results, create, search, clear, pagination |
| Settings | Add/replace/remove each provider key, invalid key, clipboard failure, theme |
| Workspace | Panel collapse/resize, selected source, study-material review, mobile tabs/overlays |
| Chat | Streaming, reasoning, citations, model search/select, attachments, submit/stop, clear |
| Sources | URL/text/file add, optimistic rows, web search/import statuses, reader fullscreen/download |
| Generation | Every material kind, model/source selection, defaults, custom counts, close/reset |
| Viewers | Quiz keyboard/review, flashcard keyboard/swipe/cloze, mind-map controls, roadmap actions |
| Tree | Keyboard navigation, rename, context menu, create/delete/duplicate/move, DnD, mobile pointer |

### Final repository gate

After all frontend packets pass, run the repository quality gate exactly in order:

1. `pnpm run lint`
2. `pnpm run typecheck`
3. `pnpm run test`

Backend tests require their documented PostgreSQL test database. If that prerequisite is unavailable, report the blocker and the completed frontend test result; do not claim the full quality gate passed.

## Definition of done

- [ ] Every targeted main component appears first and reads as a semantic UI outline.
- [ ] No main JSX contains multi-step handlers, business transformations, or deeply nested state/list logic.
- [ ] Extracted hooks are cohesive and do not hide unrelated behavior behind one controller.
- [ ] Extracted components have focused names and small, understandable prop contracts.
- [ ] No generic mega-component or speculative shared abstraction was introduced.
- [ ] Existing public APIs, barrels, event contracts, DOM/ARIA, `data-slot`, class strings, and timing are preserved.
- [ ] Confirmed legacy tree code and obsolete state are removed; uncertain prototypes remain explicit decision gates.
- [ ] Targeted characterization tests and all existing frontend tests pass.
- [ ] Lint/typecheck pass, lint warnings do not increase, and no new Steiger findings appear.
- [ ] Browser smoke cases pass at relevant desktop/mobile widths.
- [ ] Every packet ends with a concise “What changed & why.”
- [ ] Final handoff lists changed files, tests run, baseline warnings still present, and any deferred decision gates.

## Stop conditions

Stop and reassess the current packet if:

- An extraction requires changing a public component contract used outside its slice.
- A child needs five or more unrelated props or a broad controller bag.
- Moving a hook changes effect timing, default synchronization, object-URL cleanup, keyboard ordering, or optimistic state behavior.
- A “shared” component needs labels, variants, or callbacks specific to several consumers.
- Tests reveal the existing behavior is unclear or contradictory.
- The current HEAD has materially diverged from the audited commit.

When a stop condition occurs, keep the last passing semantic seam, document the ambiguity, and defer the broader change rather than forcing an abstraction.
