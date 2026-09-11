import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2 } from "lucide-react";

export interface VideoPlayerViewProps {
  isYouTube: boolean;
  youtubeVideoId: string | null;
  sourceTitle: string;
  videoSrc: string | undefined;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  isLoadingVideo: boolean;
  isVideoError: boolean;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
}

export function VideoPlayerView({
  isYouTube,
  youtubeVideoId,
  sourceTitle,
  videoSrc,
  videoRef,
  iframeRef,
  isLoadingVideo,
  isVideoError,
  onTimeUpdate,
  onLoadedMetadata,
}: VideoPlayerViewProps) {
  const { t } = useTranslation("sourceRenderers");
  return (
    <>
      {isYouTube && youtubeVideoId ? (
        <iframe
          ref={iframeRef}
          data-testid="youtube-iframe"
          src={`https://www.youtube.com/embed/${youtubeVideoId}?enablejsapi=1`}
          title={sourceTitle}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <video
          ref={videoRef}
          data-testid="video-element"
          src={videoSrc}
          controls
          playsInline
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          className="w-full h-full object-contain bg-black"
        />
      )}

      {isLoadingVideo && !isYouTube && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs text-white gap-2">
          <Loader2 className="size-7 animate-spin text-primary" />
          <span className="text-xs font-medium">{t("videoPlayer.loadingVideo")}</span>
        </div>
      )}

      {isVideoError && !videoSrc && !isYouTube && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-warning gap-2 p-4 text-center">
          <AlertTriangle className="size-7 text-destructive" />
          <span className="text-sm font-semibold text-foreground">
            {t("videoPlayer.streamUnavailable")}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("videoPlayer.videoLoadFailed")}
          </span>
        </div>
      )}
    </>
  );
}
