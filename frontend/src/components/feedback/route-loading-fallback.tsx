import { Spinner } from "@/components/ui/spinner";

export function RouteLoadingFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}
