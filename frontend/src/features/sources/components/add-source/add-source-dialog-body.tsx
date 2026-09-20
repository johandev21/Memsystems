import { TextInputMode } from "../text-input-mode";
import { UrlInputMode } from "../url-input-mode";
import { AddSourceMenuBlock } from "./add-source-menu-block";
import { SourceLimitMeter } from "./source-limit-meter";

export interface AddSourceDialogBodyProps {
  mode: string;
  notebookId: string;
  remainingSourceSlots: number;
  onSelectUrlMode: () => void;
  onSelectTextMode: () => void;
  onUploadFile: (file: File) => void;
  urlValue: string;
  onUrlValueChange: (v: string) => void;
  urlTitle: string;
  onUrlTitleChange: (v: string) => void;
  captionText: string;
  onCaptionTextChange: (v: string) => void;
  oauthToken: string;
  onOauthTokenChange: (v: string) => void;
  onSubmitUrl: () => void;
  onBackToMenu: () => void;
  textTitle: string;
  onTextTitleChange: (v: string) => void;
  textBody: string;
  onTextBodyChange: (v: string) => void;
  onSubmitText: () => void;
  count: number;
  usedPercent: number;
}

export function AddSourceDialogBody({
  mode,
  notebookId,
  remainingSourceSlots,
  onSelectUrlMode,
  onSelectTextMode,
  onUploadFile,
  urlValue,
  onUrlValueChange,
  urlTitle,
  onUrlTitleChange,
  captionText,
  onCaptionTextChange,
  oauthToken,
  onOauthTokenChange,
  onSubmitUrl,
  onBackToMenu,
  textTitle,
  onTextTitleChange,
  textBody,
  onTextBodyChange,
  onSubmitText,
  count,
  usedPercent,
}: AddSourceDialogBodyProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pb-safe-lg pt-2 sm:px-6 sm:pb-6">
      {mode === "menu" && (
        <AddSourceMenuBlock
          notebookId={notebookId}
          remainingSourceSlots={remainingSourceSlots}
          onSelectUrlMode={onSelectUrlMode}
          onSelectTextMode={onSelectTextMode}
          onUploadFile={onUploadFile}
        />
      )}

      {mode === "url" && (
        <UrlInputMode
          urlValue={urlValue}
          onUrlValueChange={onUrlValueChange}
          urlTitle={urlTitle}
          onUrlTitleChange={onUrlTitleChange}
          captionText={captionText}
          onCaptionTextChange={onCaptionTextChange}
          oauthToken={oauthToken}
          onOauthTokenChange={onOauthTokenChange}
          onSubmit={onSubmitUrl}
          onBack={onBackToMenu}
          isPending={false}
          busy={false}
        />
      )}

      {mode === "text" && (
        <TextInputMode
          textTitle={textTitle}
          onTextTitleChange={onTextTitleChange}
          textBody={textBody}
          onTextBodyChange={onTextBodyChange}
          onSubmit={onSubmitText}
          onBack={onBackToMenu}
          isPending={false}
          busy={false}
        />
      )}

      <SourceLimitMeter count={count} usedPercent={usedPercent} />
    </div>
  );
}
