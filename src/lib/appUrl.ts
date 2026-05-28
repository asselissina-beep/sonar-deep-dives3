/**
 * Public site URL helpers. Set at build time via Vite env (see .env.example).
 */

function parseAppOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.origin;
    }
  } catch {
    /* invalid */
  }
  return null;
}

/** Origin from VITE_APP_ORIGIN, or fallback (e.g. window.location.origin on the client). */
export function getAppOrigin(fallbackOrigin = ""): string {
  return parseAppOrigin(import.meta.env.VITE_APP_ORIGIN) ?? fallbackOrigin;
}

/** Configured origin only — undefined when VITE_APP_ORIGIN is unset. */
export function getConfiguredAppOrigin(): string | undefined {
  return parseAppOrigin(import.meta.env.VITE_APP_ORIGIN) ?? undefined;
}

/** Absolute public URL for a path (e.g. `/scoreboard`). Undefined if VITE_APP_ORIGIN is unset. */
export function getAppUrl(path = ""): string | undefined {
  const origin = getConfiguredAppOrigin();
  if (!origin) return undefined;
  if (!path) return origin;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Default Open Graph image from VITE_OG_IMAGE_URL. */
export function getDefaultOgImageUrl(): string | undefined {
  const url = import.meta.env.VITE_OG_IMAGE_URL?.trim();
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.href;
    }
  } catch {
    /* invalid */
  }
  return undefined;
}
