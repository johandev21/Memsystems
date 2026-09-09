import { useQuery } from "@tanstack/react-query";
import { type ReactElement, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SOURCE_LIMIT, sourcesQueryOptions } from "../api/sources";
import { useAddSourceDialogState } from "../hooks/use-add-source-dialog-state";
import { useAddSourceActions } from "../hooks/use-add-source-actions";
import { AddSourceDialogBody } from "./add-source/add-source-dialog-body";

export function AddSourceDialog({
  notebookId,
  children,
}: {
  notebookId: string;
  children: ReactElement;
}) {
  const { data: sources } = useQuery(sourcesQueryOptions(notebookId));
  const [open, setOpen] = useState(false);
  const sourceState = useAddSourceDialogState();
  const {
    mode,
    setMode,
    urlValue,
    setUrlValue,
    urlTitle,
    setUrlTitle,
    captionText,
    setCaptionText,
    oauthToken,
    setOauthToken,
    textTitle,
    setTextTitle,
    textBody,
    setTextBody,
    reset,
  } = sourceState;

  const count = sources?.length ?? 0;
  const remainingSourceSlots = Math.max(SOURCE_LIMIT - count, 0);
  const usedPercent = Math.min((count / SOURCE_LIMIT) * 100, 100);

  const handleCloseAndReset = () => {
    setOpen(false);
    reset();
  };

  const {
    handleStartUrlUpload,
    handleStartFileUpload,
    handleStartTextUpload,
  } = useAddSourceActions(notebookId, sourceState, handleCloseAndReset);

  const isNativeButton = children.type === "button";

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) reset();
      }}
    >
      <DialogTrigger render={children} nativeButton={isNativeButton} />
      <DialogContent
        motion={false}
        className="flex max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] flex-col overflow-hidden rounded-[min(var(--radius-4xl),24px)] border-border/60 bg-card p-0 shadow-2xl sm:max-h-[90vh] sm:max-w-[680px]"
      >
        <DialogHeader className="shrink-0 px-5 pb-2 pt-6 sm:px-6">
          <DialogTitle className="text-center text-xl font-semibold text-foreground">
            Add Knowledge Sources
          </DialogTitle>
          <DialogDescription className="text-center">
            Search the web or bring in your own material.
          </DialogDescription>
        </DialogHeader>

        <AddSourceDialogBody
          mode={mode}
          notebookId={notebookId}
          remainingSourceSlots={remainingSourceSlots}
          onSelectUrlMode={() => setMode("url")}
          onSelectTextMode={() => setMode("text")}
          onUploadFile={handleStartFileUpload}
          urlValue={urlValue}
          onUrlValueChange={setUrlValue}
          urlTitle={urlTitle}
          onUrlTitleChange={setUrlTitle}
          captionText={captionText}
          onCaptionTextChange={setCaptionText}
          oauthToken={oauthToken}
          onOauthTokenChange={setOauthToken}
          onSubmitUrl={handleStartUrlUpload}
          onBackToMenu={() => setMode("menu")}
          textTitle={textTitle}
          onTextTitleChange={setTextTitle}
          textBody={textBody}
          onTextBodyChange={setTextBody}
          onSubmitText={handleStartTextUpload}
          count={count}
          usedPercent={usedPercent}
        />
      </DialogContent>
    </Dialog>
  );
}
