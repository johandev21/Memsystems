import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu";
import { OverlayLayerContext } from "@/shared/components/ui/overlay-layer";
import type { StudyMaterialDTO } from "../types/study-material.types";
import { MaterialViewer } from "./MaterialViewer";

vi.mock("./material-content-renderer", () => ({
  MaterialContentRenderer: () => (
    <DropdownMenu>
      <DropdownMenuTrigger>Node actions</DropdownMenuTrigger>
      <DropdownMenuContent><DropdownMenuItem>Ask in chat</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>
  ),
}));

const material: StudyMaterialDTO = {
  id: "map", notebookId: "notebook", kind: "mind_map", title: "Map", folderId: null,
  content: {}, options: null, deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("material viewer menus", () => {
  it("places a fullscreen viewer menu above the viewer", async () => {
    render(<MaterialViewer material={material} onClose={vi.fn()} defaultFullscreen />);
    await userEvent.click(screen.getByRole("button", { name: "Node actions" }));
    const menu = await screen.findByRole("menu");
    expect(menu.className).toContain("z-viewer-popover");
  });

  it("preserves an enclosing modal's higher overlay layer", async () => {
    render(<OverlayLayerContext.Provider value="z-modal-popover"><MaterialViewer material={material} onClose={vi.fn()} defaultFullscreen /></OverlayLayerContext.Provider>);
    await userEvent.click(screen.getByRole("button", { name: "Node actions" }));
    expect((await screen.findByRole("menu")).className).toContain("z-modal-popover");
  });
});
