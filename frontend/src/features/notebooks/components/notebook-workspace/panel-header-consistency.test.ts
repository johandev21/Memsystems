import { describe, expect, it } from "vitest";

/**
 * Every panel header inside the /notebooks/$id route must be exactly 44px tall
 * (`p-1.5` + `min-h-11`) in all states (loaded, loading, viewer open) and on every
 * breakpoint. Mobile touch work must NOT enlarge them: children stay `h-8`.
 */
const sources = import.meta.glob<string>(
  [
    "/src/features/notebook-chat/components/chat-panel-header.tsx",
    "/src/features/notebooks/components/notebook-workspace/sources-panel-header.tsx",
    "/src/features/notebooks/components/notebook-workspace/studio-panel-header.tsx",
    "/src/features/sources/components/content-viewer/source-reader-header.tsx",
    "/src/features/sources/components/skeletons/source-reader-skeleton.tsx",
    "/src/features/study-material-viewer/components/material-viewer-header.tsx",
    "/src/features/study-material-viewer/components/skeletons/MaterialViewerSkeleton.tsx",
    "/src/pages/notebooks/notebook-page-skeleton.tsx",
  ],
  { query: "?raw", import: "default", eager: true },
);

const PANEL_HEADERS = Object.keys(sources);

function read(path: string) {
  return sources[path];
}

describe("notebook panel headers", () => {
  it.each(PANEL_HEADERS)("%s keeps the shared 44px header height", (path) => {
    const source = read(path);

    expect(source).toContain("bg-panel-header-bg");
    expect(source.match(/min-h-11/g)).toHaveLength(1);
    expect(source).toContain("p-1.5");
  });

  it.each(PANEL_HEADERS)("%s does not enlarge header children on any breakpoint", (path) => {
    const source = read(path);

    // Unprefixed min-h/min-w on a child grows the header on desktop too (`sm:h-8` does not reset it).
    expect(source).not.toMatch(/min-w-11/);
    expect(source).not.toMatch(/sm:(?:size|h)-8/);
  });
});
