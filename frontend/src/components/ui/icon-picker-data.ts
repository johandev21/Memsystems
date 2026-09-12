// The full icon-name list comes from lucide's dynamic-import map (~55 KB gz),
// so it is loaded on demand when the picker popover opens rather than statically.
export async function loadAllIconNames(): Promise<string[]> {
  const { dynamicIconImports } = await import("lucide-react/dynamic");
  return Object.keys(dynamicIconImports);
}

export type IconCategoryKey =
  | "iconPicker.categories.communication"
  | "iconPicker.categories.files"
  | "iconPicker.categories.media"
  | "iconPicker.categories.objects"
  | "iconPicker.categories.popular"
  | "iconPicker.categories.system"
  | "iconPicker.categories.tech";

export interface CuratedCategory {
  labelKey: IconCategoryKey;
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
    labelKey: "iconPicker.categories.popular",
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
    labelKey: "iconPicker.categories.tech",
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
    labelKey: "iconPicker.categories.files",
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
    labelKey: "iconPicker.categories.communication",
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
    labelKey: "iconPicker.categories.objects",
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
    labelKey: "iconPicker.categories.system",
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
    labelKey: "iconPicker.categories.media",
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
