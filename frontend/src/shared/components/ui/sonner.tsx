import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster({ ...props }: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-right"
      style={
        {
          "--normal-bg": "var(--background)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      mobileOffset={{
        bottom:
          "calc(var(--composer-height, env(safe-area-inset-bottom, 0px)) + 1rem)",
        left: "1rem",
        right: "1rem",
      }}
      toastOptions={{
        classNames: {
          toast:
            "!border !border-border !bg-background !text-foreground shadow-xl rounded-2xl px-4 py-3 text-sm font-medium",
          description: "!text-muted-foreground text-xs",
          actionButton:
            "bg-primary text-primary-foreground font-medium rounded-xl text-xs px-3 py-1.5",
          cancelButton:
            "bg-muted text-muted-foreground font-medium rounded-xl text-xs px-3 py-1.5",
          success: "!border-border/80",
          error: "!border-destructive/40 !text-destructive",
          warning: "!border-warning/40",
          info: "!border-info/40",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
