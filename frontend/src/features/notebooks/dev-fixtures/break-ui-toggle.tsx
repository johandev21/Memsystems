import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { type BreakUiMode, getBreakUiMode } from "./index";

const MODES: { id: BreakUiMode; label: string }[] = [
  { id: "demo", label: "Demo" },
  { id: "worst", label: "Worst case" },
  { id: "empty", label: "Empty" },
  { id: "one", label: "One" },
  { id: "huge", label: "1,000 rows" },
];

export function BreakUiToggle() {
  const queryClient = useQueryClient();
  const [currentMode, setCurrentMode] = useState<BreakUiMode>(getBreakUiMode());
  const [isRtl, setIsRtl] = useState(() => {
    if (typeof window === "undefined") return false;
    const dir = new URLSearchParams(window.location.search).get("dir");
    if (dir === "rtl") {
      document.documentElement.dir = "rtl";
      return true;
    }
    return false;
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentMode(getBreakUiMode());
      const dir = new URLSearchParams(window.location.search).get("dir");
      const nextRtl = dir === "rtl";
      setIsRtl(nextRtl);
      document.documentElement.dir = nextRtl ? "rtl" : "ltr";
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSelectMode = (mode: BreakUiMode) => {
    setCurrentMode(mode);
    const url = new URL(window.location.href);
    if (mode === "demo") {
      url.searchParams.delete("data");
    } else {
      url.searchParams.set("data", mode);
    }
    window.history.pushState({}, "", url.toString());
    queryClient.invalidateQueries();
  };

  const handleToggleRtl = () => {
    const nextRtl = !isRtl;
    setIsRtl(nextRtl);
    document.documentElement.dir = nextRtl ? "rtl" : "ltr";
  };

  return (
    <div
      data-testid="break-ui-control"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-1.5 p-1 rounded-full bg-popover/90 text-popover-foreground border border-border shadow-2xl backdrop-blur-md text-xs font-sans select-none pointer-events-auto"
    >
      <div className="flex items-center gap-0.5 bg-muted/80 p-0.5 rounded-full">
        {MODES.map((mode) => {
          const isActive = currentMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => handleSelectMode(mode.id)}
              className={`px-2.5 py-1 rounded-full font-medium transition-none ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleToggleRtl}
        title="Toggle RTL"
        className={`px-2 py-1 rounded-full text-xs font-mono border transition-none ${
          isRtl
            ? "bg-primary text-primary-foreground border-primary font-bold"
            : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
        }`}
      >
        {isRtl ? "RTL ON" : "RTL"}
      </button>
    </div>
  );
}
