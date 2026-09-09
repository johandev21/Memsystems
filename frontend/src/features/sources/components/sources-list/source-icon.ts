import {
  BookOpen,
  Code,
  File,
  FileText,
  Headphones,
  ImageIcon,
  Link2,
  Presentation,
  Video,
} from "lucide-react";
import type { Source } from "../../api/sources";
import { isYouTubeUrl } from "../../utils/detect-document-type";

export function getSourceIcon(source: Source) {
  if (
    source.modality === "video" ||
    source.contentType?.startsWith("video/") ||
    /\.(mp4|mov|mkv)$/i.test(source.title) ||
    (source.kind === "url" && isYouTubeUrl(source.url || ""))
  ) {
    return Video;
  }
  if (
    source.modality === "audio" ||
    source.contentType?.startsWith("audio/") ||
    /\.(mp3|m4a|wav|webm|aac|ogg)$/i.test(source.title)
  ) {
    return Headphones;
  }
  if (
    source.modality === "image" ||
    source.contentType?.startsWith("image/") ||
    /\.(png|jpe?g|webp|heic|heif|gif|svg|bmp)$/i.test(source.title)
  ) {
    return ImageIcon;
  }
  if (
    source.modality === "slides" ||
    source.contentType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    /\.pptx$/i.test(source.title)
  ) {
    return Presentation;
  }
  if (
    source.modality === "ebook" ||
    source.contentType === "application/epub+zip" ||
    /\.epub$/i.test(source.title)
  ) {
    return BookOpen;
  }
  if (source.contentType === "application/x-tex" || /\.tex$/i.test(source.title)) {
    return Code;
  }
  if (
    source.contentType === "text/x-bibtex" ||
    source.contentType === "application/x-bibtex" ||
    /\.bib$/i.test(source.title)
  ) {
    return FileText;
  }
  switch (source.kind) {
    case "file":
      return FileText;
    case "url":
      return Link2;
    case "text":
      return File;
    default:
      return File;
  }
}
