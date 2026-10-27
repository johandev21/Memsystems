import { useTranslation } from "react-i18next";
import { useUpdateNotebookTitle } from "../hooks/use-update-notebook-title";

export function EditableNotebookTitle({ id }: { id: string }) {
  const { t } = useTranslation("notebooks");
  const {
    title,
    setTitle,
    currentTitle,
    isEditing,
    setIsEditing,
    isPending,
    inputRef,
    handleSave,
    handleCancel,
  } = useUpdateNotebookTitle(id);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        aria-label={t("notebook.editTitle")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") handleCancel();
        }}
        className="text-sm font-semibold px-2 py-0.5 border border-foreground/30 bg-transparent text-foreground outline-none w-full max-w-md md:max-w-lg lg:max-w-xl rounded-xl focus:ring-1 focus:ring-ring"
        maxLength={200}
        disabled={isPending}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="text-sm font-semibold px-2 py-0.5 border border-transparent hover:border-foreground/20 cursor-text select-none text-foreground transition-colors duration-150 rounded-xl min-w-0 max-w-full truncate block text-left"
    >
      <span className="block truncate max-w-[55vw] sm:max-w-[60vw] lg:max-w-none">
        {currentTitle}
      </span>
    </button>
  );
}
