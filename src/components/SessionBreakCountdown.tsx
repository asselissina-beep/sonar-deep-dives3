import { formatBreakCountdown } from "@/lib/sessionBreak";

type SessionBreakCountdownProps = {
  remainingMs: number;
  className?: string;
};

/** Cooldown UI for the phone controller only (TV stays open for the next visitor). */
export function SessionBreakCountdown({
  remainingMs,
  className = "",
}: SessionBreakCountdownProps) {
  if (remainingMs <= 0) return null;

  const label = formatBreakCountdown(remainingMs);

  return (
    <div
      className={`rounded border border-primary/40 bg-primary/10 px-4 py-3 text-center ${className}`}
      role="status"
      aria-live="polite"
      aria-label={`Session break, play again in ${label}`}
    >
      <div className="font-display text-[10px] tracking-[0.25em] text-primary/70 mb-1">
        SESSION BREAK
      </div>
      <div className="font-display text-2xl font-black tabular-nums text-primary">{label}</div>
      <p className="mt-2 font-body text-[10px] tracking-wider text-muted-foreground">
        You can play again when the timer reaches zero. The booth display is ready for the next visitor.
      </p>
    </div>
  );
}
