import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/shared/utils/cn";

export function SettingsLink() {
  const { t } = useTranslation();

  return (
    <Link
      to="/settings"
      aria-label={t("settingsLink.ariaLabel")}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon-lg" }),
        "cursor-pointer rounded-full transition-none",
      )}
    >
      <Settings className="size-4.5" />
    </Link>
  );
}
