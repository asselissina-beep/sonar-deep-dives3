import { Loader2 } from "lucide-react";

/** Shared Suspense fallback for lazily loaded route chunks. */
export default function RoutePageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
        <span className="text-xs tracking-widest font-body">{label}</span>
      </div>
    </div>
  );
}
