import { FileUploadMode } from "../file-upload-mode";
import { WebSearchComposer } from "../web-search-composer";

export interface AddSourceMenuBlockProps {
  notebookId: string;
  remainingSourceSlots: number;
  onSelectUrlMode: () => void;
  onSelectTextMode: () => void;
  onUploadFile: (file: File) => void;
}

export function AddSourceMenuBlock({
  notebookId,
  remainingSourceSlots,
  onSelectUrlMode,
  onSelectTextMode,
  onUploadFile,
}: AddSourceMenuBlockProps) {
  return (
    <>
      <WebSearchComposer notebookId={notebookId} remainingSourceSlots={remainingSourceSlots} />

      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground">Or add a source directly</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <FileUploadMode
        onSelectUrlMode={onSelectUrlMode}
        onSelectTextMode={onSelectTextMode}
        onUploadFile={onUploadFile}
        isUploading={false}
        busy={remainingSourceSlots === 0}
      />
    </>
  );
}
