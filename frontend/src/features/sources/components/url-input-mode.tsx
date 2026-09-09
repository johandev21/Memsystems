import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Loader2,
  Video,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isArXivUrl, isDoi, isYouTubeUrl } from "../utils/detect-document-type";

interface UrlInputModeProps {
  urlValue: string;
  onUrlValueChange: (v: string) => void;
  urlTitle: string;
  onUrlTitleChange: (v: string) => void;
  captionText?: string;
  onCaptionTextChange?: (v: string) => void;
  oauthToken?: string;
  onOauthTokenChange?: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  isPending: boolean;
  busy: boolean;
}

function getPlaceholder(isYouTube: boolean, isArXiv: boolean, isAcademicDoi: boolean): string {
  if (isYouTube) return "https://youtube.com/watch?v=... or https://youtu.be/...";
  if (isArXiv) return "e.g. 2301.12345 or https://arxiv.org/abs/2301.12345";
  if (isAcademicDoi) return "e.g. 10.1000/182 or https://doi.org/10.1000/182";
  return "https://example.com/article, YouTube URL, arXiv ID, or DOI...";
}

function getTitlePlaceholder(isYouTube: boolean, isArXiv: boolean, isAcademicDoi: boolean): string {
  if (isYouTube) return "Defaults to video title";
  if (isArXiv) return "Defaults to paper title";
  if (isAcademicDoi) return "Defaults to publication title";
  return "Defaults to webpage title";
}

function getSubmitLabel(isYouTube: boolean, isArXiv: boolean, isAcademicDoi: boolean): string {
  if (isYouTube) return "Add YouTube Video Source";
  if (isArXiv) return "Add arXiv Paper Source";
  if (isAcademicDoi) return "Add DOI Academic Source";
  return "Add Website Source";
}

function getPendingLabel(isYouTube: boolean, isArXiv: boolean, isAcademicDoi: boolean): string {
  if (isYouTube) return "Adding YouTube video...";
  if (isArXiv) return "Acquiring arXiv paper...";
  if (isAcademicDoi) return "Resolving DOI...";
  return "Extracting website...";
}

function UrlTypeBadge({
  isYouTube,
  isArXiv,
  isAcademicDoi,
}: {
  isYouTube: boolean;
  isArXiv: boolean;
  isAcademicDoi: boolean;
}) {
  if (isYouTube) {
    return (
      <Badge
        variant="outline"
        data-testid="youtube-badge"
        className="gap-1 border-red-500/30 bg-red-500/10 text-xs font-normal text-red-600 dark:text-red-400"
      >
        <Video className="size-3 text-red-600 dark:text-red-400" />
        YouTube Video
      </Badge>
    );
  }
  if (isArXiv) {
    return (
      <Badge
        variant="outline"
        data-testid="arxiv-badge"
        className="gap-1 border-indigo-500/30 bg-indigo-500/10 text-xs font-normal text-indigo-600 dark:text-indigo-400"
      >
        <BookOpen className="size-3 text-indigo-600 dark:text-indigo-400" />
        arXiv Paper
      </Badge>
    );
  }
  if (isAcademicDoi) {
    return (
      <Badge
        variant="outline"
        data-testid="doi-badge"
        className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-xs font-normal text-emerald-600 dark:text-emerald-400"
      >
        <GraduationCap className="size-3 text-emerald-600 dark:text-emerald-400" />
        DOI Identifier
      </Badge>
    );
  }
  return null;
}

interface AdvancedYouTubeSectionProps {
  captionText: string;
  onCaptionTextChange: (v: string) => void;
  oauthToken: string;
  onOauthTokenChange?: (v: string) => void;
  busy: boolean;
}

function AdvancedYouTubeSection({
  captionText,
  onCaptionTextChange,
  oauthToken,
  onOauthTokenChange,
  busy,
}: AdvancedYouTubeSectionProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        onCaptionTextChange(content);
      }
    };
    reader.readAsText(file);
  };

  const lineCount = captionText ? captionText.split("\n").length : 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/20 p-3">
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <span>Custom Captions & OAuth Options</span>
        {showAdvanced ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>

      {showAdvanced && (
        <div className="flex flex-col gap-3 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="caption-file" className="text-xs">
              Upload Subtitles / Captions (.srt, .vtt, .txt, .json)
            </Label>
            <Input
              id="caption-file"
              type="file"
              accept=".srt,.vtt,.txt,.json,.json3"
              onChange={handleFileUpload}
              disabled={busy}
              className="text-xs file:text-xs"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="caption-text" className="text-xs">
                Or Paste Subtitle / Transcript Text
              </Label>
              {captionText.length > 0 && (
                <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <span>
                    {lineCount.toLocaleString()} {lineCount === 1 ? "line" : "lines"} ·{" "}
                    {captionText.length.toLocaleString()} chars
                  </span>
                  <button
                    type="button"
                    onClick={() => onCaptionTextChange("")}
                    disabled={busy}
                    className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            <Textarea
              id="caption-text"
              placeholder="00:00:01.000 --> 00:00:04.000&#10;Speaker: Text content..."
              value={captionText}
              onChange={(e) => onCaptionTextChange(e.target.value)}
              disabled={busy}
              rows={3}
              className="min-h-24 max-h-52 overflow-y-auto resize-y font-mono text-xs"
            />
          </div>

          {onOauthTokenChange && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="oauth-token" className="text-xs">
                Google OAuth Access Token (Optional, for private videos)
              </Label>
              <Input
                id="oauth-token"
                type="password"
                placeholder="ya29.a0A..."
                value={oauthToken}
                onChange={(e) => onOauthTokenChange(e.target.value)}
                disabled={busy}
                className="text-xs"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function UrlInputMode({
  urlValue,
  onUrlValueChange,
  urlTitle,
  onUrlTitleChange,
  captionText = "",
  onCaptionTextChange,
  oauthToken = "",
  onOauthTokenChange,
  onSubmit,
  onBack,
  isPending,
  busy,
}: UrlInputModeProps) {
  const isYouTube = isYouTubeUrl(urlValue);
  const isArXiv = isArXivUrl(urlValue);
  const isAcademicDoi = isDoi(urlValue);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (urlValue.trim()) onSubmit();
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <button
        type="button"
        onClick={onBack}
        disabled={busy}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="source-url">URL or Academic Identifier</Label>
          <UrlTypeBadge
            isYouTube={isYouTube}
            isArXiv={isArXiv}
            isAcademicDoi={isAcademicDoi}
          />
        </div>
        <Input
          id="source-url"
          type="text"
          placeholder={getPlaceholder(isYouTube, isArXiv, isAcademicDoi)}
          value={urlValue}
          onChange={(e) => onUrlValueChange(e.target.value)}
          autoFocus
          required
          disabled={busy}
        />
        {isArXiv && (
          <p className="text-xs text-muted-foreground">
            Imports paper metadata and PDF full-text from arXiv.
          </p>
        )}
        {isAcademicDoi && (
          <p className="text-xs text-muted-foreground">
            Resolves citation metadata, BibTeX, and accessible open-access articles.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="source-url-title">Title (Optional)</Label>
        <Input
          id="source-url-title"
          placeholder={getTitlePlaceholder(isYouTube, isArXiv, isAcademicDoi)}
          value={urlTitle}
          onChange={(e) => onUrlTitleChange(e.target.value)}
          disabled={busy}
        />
      </div>

      {isYouTube && onCaptionTextChange && (
        <AdvancedYouTubeSection
          captionText={captionText}
          onCaptionTextChange={onCaptionTextChange}
          oauthToken={oauthToken}
          onOauthTokenChange={onOauthTokenChange}
          busy={busy}
        />
      )}

      <Button type="submit" disabled={busy || !urlValue.trim()} className="cursor-pointer">
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {getPendingLabel(isYouTube, isArXiv, isAcademicDoi)}
          </>
        ) : (
          getSubmitLabel(isYouTube, isArXiv, isAcademicDoi)
        )}
      </Button>
    </form>
  );
}
