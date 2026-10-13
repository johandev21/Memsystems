import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

export interface MobileRenameSheetProps {
  open: boolean;
  initialValue: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

export function MobileRenameSheet({ open, initialValue, onCommit, onCancel }: MobileRenameSheetProps) {
  return (
    <Drawer open={open} onOpenChange={(next) => !next && onCancel()}>
      <DrawerContent className="p-4 pb-safe-lg">
        {open && <RenameForm initialValue={initialValue} onCommit={onCommit} />}
      </DrawerContent>
    </Drawer>
  );
}

function RenameForm({
  initialValue,
  onCommit,
}: {
  initialValue: string;
  onCommit: (name: string) => void;
}) {
  const { t } = useTranslation(["sources", "tree"]);
  const [value, setValue] = useState(initialValue);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onCommit(value);
      }}
    >
      <DrawerHeader className="pb-3 text-left">
        <DrawerTitle className="text-base font-semibold">
          {t("tree:actions.rename", "Rename")}
        </DrawerTitle>
      </DrawerHeader>
      <Input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        aria-label={t("sources:mobile.nameLabel", "Name")}
        enterKeyHint="done"
        className="h-12 px-3.5"
      />
      <Button
        type="submit"
        disabled={!value.trim()}
        className="mt-3 h-12 w-full cursor-pointer touch-manipulation active:scale-97"
      >
        {t("sources:mobile.save", "Save")}
      </Button>
    </form>
  );
}
