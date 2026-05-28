import { getAppBuildVersion } from "@/lib/buildVersion";

export function AppBuildVersion() {
  const version = getAppBuildVersion();
  if (!version) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-0 right-0 z-[60] px-2 py-1 text-[9px] tabular-nums tracking-wider text-white/35"
      style={{ fontFamily: "'Share Tech Mono', monospace" }}
      aria-label={`Build ${version}`}
    >
      v{version}
    </div>
  );
}
