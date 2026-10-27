import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const { t } = useTranslation();

  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label={t("spinner.loading")}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
