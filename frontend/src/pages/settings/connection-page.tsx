import { AppHeader } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ConnectionPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="font-heading text-2xl font-semibold tracking-[-0.03em] mb-2">
          AI Connection Configuration
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Configure model endpoints and backend services
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Provider Status</CardTitle>
            <CardDescription>Backend AI providers and available language models</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Refer to the main settings page to manage your AI provider API keys.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
