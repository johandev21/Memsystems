import { ScrollArea } from "@/shared/ui/scroll-area";
import { Tabs, TabsContent } from "@/shared/ui/tabs";
import { useEffect, useState } from "react";
import { ChatPanel } from "@/features/notebook-chat";
import { SourceContentViewer, SourcesPanel } from "@/features/sources";
import { GenerateBriefDialog, MobileStudyMaterialsPanel } from "@/features/study-materials";
import { StudioResources, RightPane } from "@/features/notebooks";
import type { UseStudioDialogsReturn } from "@/features/notebooks";
import { MobileTabsHeader } from "./mobile-tabs-header";

export interface MobileNotebookLayoutProps {
  notebookId: string;
  dialogs: UseStudioDialogsReturn;
  selectedSourceId: string | null;
  onSelectSource: (id: string | null) => void;
}

export function MobileNotebookLayout({
  notebookId,
  dialogs,
  selectedSourceId,
  onSelectSource,
}: MobileNotebookLayoutProps) {
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
      new CustomEvent("send-chat-prompt", {
        detail: { ...detail, chatNavigationRetry: true },
      }),
    );
  }, [activeTab, pendingChatPrompt]);

  // Mobile fullscreen overlays — lock body scroll while a viewer is open
  useEffect(() => {
    const hasOverlay = Boolean(selectedSourceId || dialogs.selectedStudyMaterialId);
    if (!hasOverlay) return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedSourceId, dialogs.selectedStudyMaterialId]);

  return (
    <div className="lg:hidden h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full gap-0">
        <MobileTabsHeader notebookId={notebookId} />

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
                open={dialogs.studyMaterialsDialogOpen}
                onOpenChange={dialogs.setStudyMaterialsDialogOpen}
                selectedMaterialId={dialogs.selectedStudyMaterialId}
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
      {dialogs.dialogOpen && (
        <GenerateBriefDialog
          notebookId={notebookId}
          kind={dialogs.generateKind}
          models={dialogs.models}
          open={dialogs.dialogOpen}
          onOpenChange={dialogs.setDialogOpen}
          onComplete={dialogs.handleGenerateComplete}
        />
      )}
    </div>
  );
}
