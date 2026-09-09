import { ArrowLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChatPanel } from "@/features/notebook-chat";
import { SourceContentViewer, SourcesPanel } from "@/features/sources";
import { MobileStudyMaterialsPanel } from "@/features/study-material-tree";
import { StudioResources } from "../shared/studio-resources";
import { RightPane } from "../studio/right-pane";
import type { UseStudioDialogsReturn } from "../../hooks/use-studio-dialogs";
import type { SourceSegmentLocator } from "@/features/sources";
import { MobileTabsHeader } from "./mobile-tabs-header";

export interface MobileNotebookLayoutProps {
  notebookId: string;
  dialogs: UseStudioDialogsReturn;
  selectedSourceId: string | null;
  selectedLocator?: SourceSegmentLocator | null;
  onSelectSource: (id: string | null) => void;
}

export function MobileNotebookLayout({
  notebookId,
  dialogs,
  selectedSourceId,
  selectedLocator,
  onSelectSource,
}: MobileNotebookLayoutProps) {
  const [activeTab, setActiveTab] = useMobileChatNavigation();
  const [suspendedMaterialId, setSuspendedMaterialId] = useState<string | null>(null);

  useEffect(() => {
    const handleHandoff = (event: Event) => {
      const detail = (event as CustomEvent<{ materialId?: string; suspended?: boolean }>).detail;
      if (detail?.suspended && detail.materialId) {
        setSuspendedMaterialId(detail.materialId);
      } else if (detail?.suspended === false) {
        setSuspendedMaterialId(null);
      }
    };
    window.addEventListener("study-material-chat-handoff", handleHandoff);
    return () => window.removeEventListener("study-material-chat-handoff", handleHandoff);
  }, []);

  const isMaterialReviewSuspended = Boolean(
    dialogs.selectedStudyMaterialId &&
      suspendedMaterialId === dialogs.selectedStudyMaterialId,
  );

  useMobileOverlayScrollLock(
    Boolean(selectedSourceId || (dialogs.selectedStudyMaterialId && !isMaterialReviewSuspended)),
  );

  return (
    <div className="lg:hidden h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full gap-0">
        <MobileTabsHeader notebookId={notebookId} />
        {isMaterialReviewSuspended && dialogs.selectedStudyMaterialId && (
          <div className="shrink-0 px-3 pb-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-center gap-1.5 cursor-pointer"
              onClick={() => window.dispatchEvent(new CustomEvent("restore-study-material"))}
            >
              <ArrowLeft className="size-3.5" />
              Back to Material
            </Button>
          </div>
        )}

        <TabsContent value="sources" className="flex-1 mt-0 min-h-0">
          <SourcesPanel notebookId={notebookId} onSelectSource={onSelectSource} />
        </TabsContent>

        <TabsContent value="chat" className="flex-1 mt-0 min-h-0">
          <ChatPanel notebookId={notebookId} />
        </TabsContent>

        <TabsContent value="studio" className="flex-1 mt-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-3">
              <StudioResources
                notebookId={notebookId}
                collapsed={false}
                onGenerate={dialogs.handleGenerate}
              />
              <MobileStudyMaterialsPanel
                notebookId={notebookId}
                onSelectMaterial={dialogs.setSelectedStudyMaterialId}
              />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Mobile-only fullscreen viewers — never inline, always overlay */}
      {selectedSourceId && (
        <SourceContentViewer
          sourceId={selectedSourceId}
          selectedLocator={selectedLocator}
          onClose={() => onSelectSource(null)}
          forceFullscreen
        />
      )}
      {dialogs.selectedStudyMaterialId && (
        <RightPane
          notebookId={notebookId}
          mode={{
            kind: "viewer",
            materialId: dialogs.selectedStudyMaterialId,
          }}
          onModeChange={(mode) => {
            if (mode.kind === "select") {
              dialogs.setSelectedStudyMaterialId(null);
            }
          }}
          forceFullscreen
        />
      )}
    </div>
  );
}

function useMobileChatNavigation() {
  const [activeTab, setActiveTab] = useState("chat");
  const [pendingChatPrompt, setPendingChatPrompt] = useState<{
    prompt: string;
    autoSend?: boolean;
    focusChat?: boolean;
    concept?: string;
    chatNavigationRetry?: boolean;
  } | null>(null);

  useEffect(() => {
    const handleChatNavigation = (event: Event) => {
      if (!window.matchMedia("(max-width: 1023px)").matches) return;
      const detail = (event as CustomEvent<typeof pendingChatPrompt>).detail;
      if (!detail?.focusChat || detail.chatNavigationRetry) return;
      setPendingChatPrompt(detail);
      setActiveTab("chat");
    };
    window.addEventListener("send-chat-prompt", handleChatNavigation);
    return () => window.removeEventListener("send-chat-prompt", handleChatNavigation);
  }, []);

  useEffect(() => {
    if (activeTab !== "chat" || !pendingChatPrompt) return;
    const detail = pendingChatPrompt;
    setPendingChatPrompt(null);
    window.dispatchEvent(
      new CustomEvent("send-chat-prompt", { detail: { ...detail, chatNavigationRetry: true } }),
    );
  }, [activeTab, pendingChatPrompt]);

  return [activeTab, setActiveTab] as const;
}

function useMobileOverlayScrollLock(hasOverlay: boolean) {
  useEffect(() => {
    if (!hasOverlay || !window.matchMedia("(max-width: 1023px)").matches) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [hasOverlay]);
}
