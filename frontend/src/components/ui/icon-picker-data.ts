import { dynamicIconImports } from "lucide-react/dynamic";

export const ALL_ICON_NAMES = Object.keys(dynamicIconImports);

export interface CuratedCategory {
  name: string;
  icons: string[];
}

export function formatIconLabel(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export const CURATED_CATEGORIES: CuratedCategory[] = [
  {
    name: "Popular",
    icons: [
      "notebook",
      "book-open",
      "brain",
      "rocket",
      "terminal",
      "globe",
      "compass",
      "folder",
      "code",
      "cpu",
      "database",
      "hammer",
      "zap",
      "sparkles",
      "star",
      "layout",
      "file-text",
      "folder-open",
      "settings",
      "user",
      "bell",
      "calendar",
      "bookmark",
      "tag",
      "layers",
      "palette",
      "music",
      "video",
      "camera",
      "mail",
      "message-square",
      "shield",
      "target",
      "award",
    ],
  },
  {
    name: "Tech",
    icons: [
      "code",
      "cpu",
      "database",
      "terminal",
      "server",
      "laptop",
      "smartphone",
      "wifi",
      "git-branch",
      "command",
      "hard-drive",
      "monitor",
      "cloud",
      "shield-check",
      "binary",
      "rss",
    ],
  },
  {
    name: "Files",
    icons: [
      "file-text",
      "file",
      "folder",
      "folder-open",
      "files",
      "archive",
      "paperclip",
      "file-code",
      "file-json",
      "file-spreadsheet",
      "file-check",
      "folder-plus",
    ],
  },
  {
    name: "Communication",
    icons: [
      "message-square",
      "mail",
      "phone",
      "send",
      "inbox",
      "share-2",
      "at-sign",
      "bell",
      "message-circle",
      "voicemail",
    ],
  },
  {
    name: "Objects",
    icons: [
      "hammer",
      "wrench",
      "key",
      "lock",
      "scissors",
      "lightbulb",
      "compass",
      "anchor",
      "briefcase",
      "gift",
      "box",
      "shopping-bag",
    ],
  },
  {
    name: "System",
    icons: [
      "settings",
      "sliders",
      "filter",
      "power",
      "shield",
      "trash-2",
      "search",
      "refresh-cw",
      "check-circle",
      "alert-circle",
      "info",
      "help-circle",
    ],
  },
  {
    name: "Media",
    icons: [
      "image",
      "music",
      "video",
      "camera",
      "headphones",
      "film",
      "mic",
      "play",
      "volume-2",
      "sparkles",
      "radio",
      "tv",
    ],
  },
];
