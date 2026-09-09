import { File, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SourceWithContent } from "../../types";
import {
  isSourceProcessing,
  processingStageLabel,
  sourceProcessingError,
  sourceProcessingStatus,
} from "../../utils/source-processing";

export function SourceProcessingState({
  source,
  onClose,
}: {
  source: SourceWithContent;
  onClose: () => void;
}) {
  const status = sourceProcessingStatus(source);
  const active = isSourceProcessing(source);
  const error = sourceProcessingError(source);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        {active ? <Loader2 className="size-6 animate-spin" /> : <File className="size-6" />}
      </div>
      <h2 className="text-lg font-bold">
        {active
          ? processingStageLabel(status, source.processingStage)
          : processingStageLabel(status)}
      </h2>
      <p className="max-w-sm text-xs text-muted-foreground">
        {active
          ? "This source will become available here when processing finishes."
          : error || "This source is not available for reading."}
      </p>
      <Button variant="outline" size="sm" onClick={onClose} className="mt-2 cursor-pointer text-xs">
        Back to Sources
      </Button>
    </div>
  );
}

export function SourceReaderError({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
        <File className="size-6" />
      </div>
      <h2 className="text-lg font-bold">Failed to load document</h2>
      <p className="max-w-xs text-xs text-muted-foreground">
        Unable to load source details. Please try again.
      </p>
      <Button variant="outline" size="sm" onClick={onClose} className="mt-2 cursor-pointer text-xs">
        Back to Sources
      </Button>
    </div>
  );
}
