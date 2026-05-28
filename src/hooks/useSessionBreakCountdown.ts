import { useEffect, useState } from "react";
import { isBreakActive } from "@/lib/sessionBreak";

/** Live countdown until `breakEndsAt` (epoch ms), or inactive when null/past. */
export function useSessionBreakCountdown(breakEndsAt: number | null) {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!isBreakActive(breakEndsAt)) {
      setRemainingMs(0);
      return;
    }
    const tick = () => {
      setRemainingMs(Math.max(0, (breakEndsAt ?? 0) - Date.now()));
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [breakEndsAt]);

  const active = isBreakActive(breakEndsAt);
  return { remainingMs, active };
}
