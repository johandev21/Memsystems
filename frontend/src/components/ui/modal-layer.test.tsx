import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "./alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Select, SelectContent, SelectItem, SelectTrigger } from "./select";

function expectLayer(slot: string, className: string) {
  const element = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);

  expect(element).not.toBeNull();
  expect(element?.classList.contains(className)).toBe(true);
}

describe("modal layer", () => {
  it("keeps dialogs above the composer layer", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Example dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expectLayer("dialog-overlay", "z-modal-backdrop");
    expectLayer("dialog-content", "z-modal-content");
  });

  it("keeps alert dialogs above the composer layer", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Example alert dialog</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>,
    );

    expectLayer("alert-dialog-overlay", "z-modal-backdrop");
    expectLayer("alert-dialog-content", "z-modal-content");
  });

  it("raises popovers opened inside a dialog above the modal content", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Example dialog</DialogTitle>
          <Popover open>
            <PopoverTrigger>Open</PopoverTrigger>
            <PopoverContent>Popover body</PopoverContent>
          </Popover>
        </DialogContent>
      </Dialog>,
    );

    expectLayer("popover-content", "z-modal-popover");
    expect(
      document.querySelector<HTMLElement>('[data-slot="popover-content"]')?.parentElement
        ?.classList,
    ).toContain("z-modal-popover");
  });

  it("raises selects opened inside a dialog above the modal content", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Example dialog</DialogTitle>
          <Select open>
            <SelectTrigger>Choose</SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Option A</SelectItem>
            </SelectContent>
          </Select>
        </DialogContent>
      </Dialog>,
    );

    expectLayer("select-content", "z-modal-popover");
    expect(
      document.querySelector<HTMLElement>('[data-slot="select-content"]')?.parentElement?.classList,
    ).toContain("z-modal-popover");
  });

  it("keeps popovers outside of dialogs on the ordinary popover layer", () => {
    render(
      <Popover open>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Popover body</PopoverContent>
      </Popover>,
    );

    expectLayer("popover-content", "z-popover");
  });

  it("allows fullscreen viewers to raise their portaled controls above the viewer", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent layerClassName="z-viewer-popover">Menu</DropdownMenuContent>
      </DropdownMenu>,
    );

    expectLayer("dropdown-menu-content", "z-viewer-popover");
    expect(
      document.querySelector<HTMLElement>('[data-slot="dropdown-menu-content"]')?.parentElement
        ?.classList,
    ).toContain("z-viewer-popover");
  });
});
