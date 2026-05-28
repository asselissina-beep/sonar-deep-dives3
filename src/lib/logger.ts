/** App console verbosity. Set `VITE_LOG_LEVEL` in `.env` to override. */
export type AppLogLevel = "silent" | "error" | "warn" | "debug";

const LEVEL_RANK: Record<AppLogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  debug: 3,
};

function resolveLogLevel(): AppLogLevel {
  const raw = import.meta.env.VITE_LOG_LEVEL;
  if (raw === "silent" || raw === "error" || raw === "warn" || raw === "debug") {
    return raw;
  }
  // Production: errors only. Dev: warnings (config validation, etc.).
  return import.meta.env.DEV ? "warn" : "error";
}

const activeLevel = resolveLogLevel();

function shouldLog(min: AppLogLevel): boolean {
  return LEVEL_RANK[activeLevel] >= LEVEL_RANK[min];
}

/** Namespaced logging — avoids noisy console in production. */
export const appLog = {
  debug(tag: string, ...args: unknown[]) {
    if (shouldLog("debug")) console.debug(`[${tag}]`, ...args);
  },
  warn(tag: string, ...args: unknown[]) {
    if (shouldLog("warn")) console.warn(`[${tag}]`, ...args);
  },
  error(tag: string, ...args: unknown[]) {
    if (shouldLog("error")) console.error(`[${tag}]`, ...args);
  },
};
