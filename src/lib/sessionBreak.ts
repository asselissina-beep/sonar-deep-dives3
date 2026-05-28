/** Admin-selectable cooldown between booth sessions (minutes). */
export const SESSION_BREAK_MINUTE_OPTIONS = [0.5, 1, 2, 3, 5] as const;
export type SessionBreakMinutes = (typeof SESSION_BREAK_MINUTE_OPTIONS)[number];

export const DEFAULT_SESSION_BREAK_ENABLED = true;
export const DEFAULT_SESSION_BREAK_MINUTES: SessionBreakMinutes = 0.5;

export function parseSessionBreakMinutes(value: unknown): SessionBreakMinutes {
  const n = typeof value === "number" ? value : Number(value);
  if (SESSION_BREAK_MINUTE_OPTIONS.includes(n as SessionBreakMinutes)) {
    return n as SessionBreakMinutes;
  }
  return DEFAULT_SESSION_BREAK_MINUTES;
}

export function sessionBreakDurationMs(minutes: SessionBreakMinutes): number {
  return minutes * 60 * 1000;
}

export function formatSessionBreakMinutes(minutes: SessionBreakMinutes): string {
  if (minutes < 1) {
    const sec = Math.round(minutes * 60);
    return `${sec}s`;
  }
  return minutes % 1 === 0 ? `${minutes}m` : `${minutes} min`;
}

/** Countdown label for UI (e.g. `0:28` or `45s`). */
export function formatBreakCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m}:${s.toString().padStart(2, "0")}`;
  return `${totalSec}s`;
}

export function isBreakActive(breakEndsAt: number | null, now = Date.now()): boolean {
  return breakEndsAt !== null && now < breakEndsAt;
}
