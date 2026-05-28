import WaitingBackground from "@/components/WaitingBackground";

/** Placeholder while client-only booth UI mounts (matches SSR fallback). */
export default function GameLobbySkeleton() {
  return (
    <div className="relative min-h-dvh overflow-x-hidden overflow-y-auto px-4 sm:px-6 py-4">
      <WaitingBackground />
      <div className="relative z-10 w-full max-w-lg lg:max-w-xl 2xl:max-w-2xl text-center space-y-4">
        <div className="h-4 w-48 mx-auto rounded bg-muted-foreground/20 animate-pulse" />
        <div className="h-16 sm:h-20 md:h-24 w-72 sm:w-96 mx-auto rounded bg-primary/10 animate-pulse" />
        <div className="h-4 w-56 mx-auto rounded bg-muted-foreground/20 animate-pulse" />
        <div className="mt-8 rounded border border-border bg-card/60 p-6 space-y-3">
          <div className="h-3 w-24 rounded bg-primary/20 animate-pulse" />
          <div className="h-3 w-full rounded bg-muted-foreground/10 animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-muted-foreground/10 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
