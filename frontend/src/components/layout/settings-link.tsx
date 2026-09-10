import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/shared/utils/cn";

export function SettingsLink() {
  return (
    <Link
      to="/settings"
      aria-label="Settings"
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon-lg" }),
        "cursor-pointer rounded-full transition-none",
      )}
    >
      <Settings className="size-4.5" />
    </Link>
  );
}
