import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ActiveGeneration } from "@/features/study-material-generation/hooks/use-generation-store";
import { ActiveGenerationList } from "./studio-resources";

function generation(id: string, status: ActiveGeneration["status"]): ActiveGeneration {
  return { id, status, notebookId: "notebook", kind: "quiz", brief: "", startedAt: 0, lastChunkAt: 0 };
}

describe("ActiveGenerationList", () => {
  it("shows counts and dismisses only failures in a large batch", () => {
    const onCancel = vi.fn();
    const generations = [...Array.from({ length: 98 }, (_, i) => generation(String(i), "streaming")), generation("failed-1", "error"), generation("failed-2", "error")];
    render(<ActiveGenerationList generations={generations} totalSourceCount={1} onCancel={onCancel} />);
    expect(screen.getByText("98 in progress")).toBeTruthy();
    expect(screen.getByText("2 failed")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Generation activity" })).getAllByRole("button")).toHaveLength(100);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss errors" }));
    expect(onCancel.mock.calls).toEqual([["failed-1"], ["failed-2"]]);
  });
});
