# Chat branch API contract

Backend contract for the chat branch UI integration (`feat/chat-experience`).

## Read history

`GET /notebooks/:notebookId/chat` returns:

```ts
{
  messages: ChatMessage[];
  selectedMessageId: string | null;
  selectedPathIds: string[];
}
```

Each message retains existing content, citation, metadata, parts, and timestamp fields, and adds:

- `parentId: string | null`: parent node in the conversation tree.
- `siblingIndex: number` (zero-based) and `siblingCount: number`: position among children of the same parent, ordered by `createdAt`, then `id`.
- `isOnSelectedPath: boolean`: node is on the ancestry of `selectedMessageId`.
- `isSelected: boolean`: node is the selected path endpoint.

`selectedPathIds` is the ordered root-to-selected-node ancestry. A null selected ID means no active path. Selection is persisted in the database per parent message, so each branch remembers its preferred next message across navigation and reloads. `selectedMessageId` remains the authoritative endpoint of the currently restored path.

## Select a branch

`POST /notebooks/:notebookId/chat/selection`

```json
{ "messageId": "<message in this notebook>" }
```

Returns `{ "selectedMessageId": "..." }`. The backend checks notebook ownership and message membership. Selecting any node restores its remembered descendant chain and returns the final node as the selected endpoint. The ancestry to the clicked node becomes the preferred path at each ancestor; descendants use their own persisted choices. A node with an explicitly empty choice stays selected with no child, including after a stopped or newly started regeneration. An uninitialized choice uses the stable oldest-child order (`createdAt`, then `id`). The returned ID is authoritative for the next generation request.

## Generate, edit, and regenerate

Continue using `POST /notebooks/:notebookId/chat` with existing `messages`, `model`, and optional `language` / `groundingMode`. The backend uses only the validated ancestry of the requested or persisted selected node; it does not derive context from globally newest rows.

- New user turn: send `parentMessageId` as the selected node ID. Omit it to use the persisted selected node. The user message ID is read from the last user item in `messages` as before.
- Selected sources: optional `sourceIds: string[]` scopes retrieval for this request. Every ID must identify an undeleted source in the notebook. Omission uses all notebook sources; `[]` means no source evidence. Pass the current source selection for new, edited, and regenerated turns.
- Edit: send `editMessageId` with the original user message ID and edited text in the last user item text part. Send the fresh ID from that last user item as its `id`; the backend persists that ID so the streamed UI message matches the durable node. The original node and descendants remain available; a fresh user sibling is created and original file attachments are copied. If the client omits the new ID, the backend generates one.
- Regenerate: send `regenerateMessageId` with the assistant message ID to regenerate. A fresh assistant sibling is created under that assistant user message. Continue to include that user message in `messages` for its text/parts.

The POST response remains the existing AI UI message stream. The new user node is selected before generation starts, and its full ancestry is remembered in the same transaction. A failed or cancelled stream can be retried by sending the same last-user message ID. A completed assistant response advances selection to that assistant and records it as the user's preferred child; a cancelled stream may persist its partial assistant response while leaving the user node explicitly childless. Retry/regenerate use the request current `model`, `groundingMode`, and `sourceIds` context. Selection writes and assistant completion serialize on the notebook row, so a stale stream cannot overwrite newer branch choices.

Invalid, foreign-notebook, wrong-role, missing-parent, or cyclic branch references return a 400 domain error; invalid source selections also return 400. A request also returns 400 if another branch selection wins before the request claims the selected user node. No retrieval or model stream starts in that case, and a newly inserted user node is removed. Keep the current transcript and refresh history before retrying. `DELETE /notebooks/:notebookId/chat` still clears the full tree and selected pointer. Migrations preserve all message nodes and parent links, retain the existing selected path, and initialize inactive choices in stable sibling order.
