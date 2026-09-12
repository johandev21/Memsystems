import { useState } from "react";
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";
import { usePrototypeInteractions } from "../hooks/use-prototype-interactions";
import type { LibrarySortKey } from "../model/library-sort";
import { CreateMenu } from "./create-menu";
import { FolderLibrary } from "./folder-library";
import { NotebookPreview } from "./prototype-cards";
import { NotebookDialog } from "./prototype-dialogs";

// Throwaway: explore notebook grouping with a folder shelf and an in-memory library.
export function NotebookFoldersPrototype() {
  const interaction = usePrototypeInteractions();
  const { library } = interaction;
  const [sortKey, setSortKey] = useState<LibrarySortKey>("name");
  // Keep the freshly created item selected while its inline rename is active.
  const draftKey = interaction.draft ? `${interaction.draft.kind}:${interaction.draft.id}` : null;
  return (
    <DndContext
      sensors={interaction.sensors}
      collisionDetection={pointerWithin}
      onDragStart={interaction.handleDragStart}
      onDragEnd={interaction.handleDragEnd}
      onDragCancel={interaction.cancelDrag}
    >
      <LibraryHero
        onCreateNotebook={interaction.beginCreateNotebook}
        onCreateFolder={interaction.beginCreateFolder}
      />
      <FolderLibrary
        folders={library.folders}
        notebooks={library.notebooks}
        activeFolderId={library.activeFolderId}
        sortKey={sortKey}
        onSortChange={setSortKey}
        draftId={interaction.draft?.id ?? null}
        selectedKey={interaction.selectedKey ?? draftKey}
        onCommitDraft={interaction.commitDraft}
        onCancelDraft={interaction.cancelDraft}
        onSelectItem={interaction.selectItem}
        onOpenFolder={(id) => {
          interaction.selectItem(null);
          library.setActiveFolderId(id);
        }}
        onMoveNotebook={library.moveNotebook}
        onRenameFolder={library.renameFolder}
        onRemoveFolder={library.removeFolder}
        onOpenNotebook={interaction.openNotebook}
        onUpdateNotebook={library.updateNotebook}
      />
      <DragOverlay>
        {interaction.draggedNotebook ? (
          <NotebookPreview notebook={interaction.draggedNotebook} />
        ) : null}
      </DragOverlay>
      {interaction.previewNotebook && (
        <NotebookDialog notebook={interaction.previewNotebook} onClose={interaction.closePreview} onUpdate={library.updateNotebook} />
      )}
    </DndContext>
  );
}

function LibraryHero({
  onCreateNotebook,
  onCreateFolder,
}: {
  onCreateNotebook: () => void;
  onCreateFolder: () => void;
}) {
  return (
    <section className="flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="max-w-md font-heading text-2xl leading-snug font-semibold tracking-[-0.03em] text-foreground">
          Make progress on what matters.
        </h1>
        <p className="text-sm text-muted-foreground">
          Pick up where you left off, or start something fresh.
        </p>
      </div>
      <CreateMenu onCreateNotebook={onCreateNotebook} onCreateFolder={onCreateFolder} />
    </section>
  );
}
