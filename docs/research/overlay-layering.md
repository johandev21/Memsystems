# Overlay layering research

**Date:** 2026-08-23
**Scope:** frontend overlay layering; no application code changed as part of this note.

## Conclusion

Do not replace the app’s custom overlay layering with the browser top layer wholesale. The native top layer is the right primitive for native `<dialog>.showModal()` and native `popover`, but this app uses Base UI’s custom React primitives: their portals append `<div>` containers to `<body>`, and their popup/backdrop parts also render `<div>` elements. Therefore the current bug still requires an author-controlled paint order.

The recommended fix is a small, centralized overlay policy with semantic layers—retaining `z-index` as the CSS mechanism—combined with explicit state ownership for modal exclusivity. The modal backdrop/content layer must be above the composer; lowering the composer globally would regress the intentional “composer above ordinary scrolling popovers” behavior.

## Local diagnosis

- The chat panel’s composer host is an absolutely positioned `z-composer` layer: [`chat-panel.tsx`](../../frontend/src/features/notebook-chat/components/chat-panel.tsx).
- Standard Base UI popovers are portaled and use the shared `z-popover` layer: [`popover.tsx`](../../frontend/src/shared/ui/popover.tsx).
- Shared Dialog and AlertDialog backdrops/content now use distinct `z-modal-backdrop` and `z-modal-content` layers: [`dialog.tsx`](../../frontend/src/shared/ui/dialog.tsx) and [`alert-dialog.tsx`](../../frontend/src/shared/ui/alert-dialog.tsx). This makes the modal relationship explicit instead of relying on a one-off larger number.
- Fullscreen material/source viewers now use the shared `z-viewer` layer ([`MaterialViewer.tsx`](../../frontend/src/features/study-materials/components/viewer/MaterialViewer.tsx), [`source-content-viewer.tsx`](../../frontend/src/features/sources/components/source-content-viewer.tsx)). This resolves the same conflict shown in the fullscreen-viewer screenshot by placing the immersive surface above the composer.

For the reported UX, the intended order is approximately:

```text
document content < ordinary popover < composer < fullscreen viewer < viewer-owned popover < modal backdrop < modal content
```

The viewer position is a product decision; the modal relationship is not—the modal backdrop must dim the composer as well as the rest of the document.

## Evidence

1. **`z-index` is local to stacking contexts.** CSS defines `z-index` as the stack level in the current stacking context, and a stacking context is painted atomically from its parent’s point of view. Increasing a number works only when the competing elements are in comparable contexts; it does not provide a universal overlay system. ([CSS 2.1, layered presentation](https://www.w3.org/TR/CSS2/visuren.html#z-index))

2. **The browser top layer solves a different problem.** CSS Positioned Layout Level 4 defines the top layer as being painted after the document root; its elements create root-level stacking contexts and cannot be clipped or obscured by ordinary document content. Authors cannot put arbitrary React `<div>` elements there directly. ([CSS Positioned Layout Level 4, top layer](https://drafts.csswg.org/css-position-4/#top-layer))

3. **Native modal dialogs have the desired modal ordering/behavior.** `showModal()` marks the dialog modal, blocks the document (making the outside focused area inert), and adds the dialog to the top layer. The top-layer `::backdrop` is painted below that dialog but above the document. ([HTML Standard, modal dialog algorithm](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element); [CSS Positioned Layout Level 4, `::backdrop`](https://drafts.csswg.org/css-position-4/#backdrop-pseudo-element))

4. **Native popovers also use the top layer, but that conflicts with the requested composer priority.** The HTML `popover` attribute renders shown content above page content, and `showPopover()` adds it to the top layer; auto popovers also participate in a browser-managed popover stack/light-dismiss model. Migrating every ordinary popover to native popover would therefore make it outrank the composer, not preserve “composer above scrolling popover.” ([HTML Standard, `popover`](https://html.spec.whatwg.org/multipage/popover.html#the-popover-attribute))

5. **Base UI 1.6.0 is portal/stacking based, not native-top-layer based.** Base UI documents Dialog and Popover portals as `<div>` elements appended to `<body>`, and documents their backdrop/popup parts as `<div>` elements. The v1.6.0 source confirms the same implementation: [`DialogPortal.tsx`](https://github.com/mui/base-ui/blob/v1.6.0/packages/react/src/dialog/portal/DialogPortal.tsx) and [`PopoverPortal.tsx`](https://github.com/mui/base-ui/blob/v1.6.0/packages/react/src/popover/portal/PopoverPortal.tsx). Base UI’s `Dialog` `modal` behavior handles focus, scroll, and outside interaction, but that behavioral state does not itself change the pixels painted above a custom composer. ([Base UI Dialog docs](https://base-ui.com/react/components/dialog); [Base UI Popover docs](https://base-ui.com/react/components/popover))

## Recommendation for this app

- Keep Base UI Dialog/AlertDialog/Popover for now. A native-top-layer rewrite would be a component-system change, not a Vite configuration improvement, and would need new lifecycle integration (`showModal()`/`showPopover()`), focus/animation validation, and a browser-support decision.
- Define semantic layer names in the shared UI policy, for example `popover`, `composer`, `viewer`, `modal-backdrop`, and `modal-content`. Use those tokens/classes consistently instead of scattering raw `z-50`, `z-[60]`, and `z-[80]` values. The implementation adds these tokens in `globals.css`; if useful later, Base UI portals can also be given a single app-owned container because its documented `Portal` API supports a `container` prop.
- Let an app-level owner decide which transient surfaces remain open when a modal opens. Closing or disabling ordinary popovers and making the composer non-interactive is state ownership; it complements, but cannot replace, putting the modal backdrop above the composer. Inertness/pointer blocking alone will not dim an element that is painted above the backdrop.
- Give fullscreen viewers an explicit layer relative to the composer. If the viewer is immersive, it belongs above the composer; viewer-owned portaled controls need a local sub-layer above the viewer but below modals.
- Add visual/browser coverage for: scrolling with an ordinary popover, dialog with the composer visible at the bottom edge, alert dialog, and fullscreen viewer. The current focused test verifies that modal surfaces opt into the semantic modal layers; browser-level coverage is still the right way to verify actual painted order.

### Decision

Use **state ownership for modality and exclusivity**, **semantic portal/layer ownership for custom Base UI surfaces**, and reserve **native top layer** for a deliberate future migration to native dialog/popover elements. Do not treat `z-index` as the product model, but do not remove it from this custom-portal architecture without replacing the primitives that currently depend on it.
