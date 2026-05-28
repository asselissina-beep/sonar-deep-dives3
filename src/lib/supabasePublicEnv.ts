/**
 * Public Supabase URL + anon/publishable key.
 * - Browser: `VITE_*` from the build (only option).
 * - Worker SSR: prefer runtime `SUPABASE_*` secrets, then baked-in `VITE_*`.
 */
export function getPublicSupabaseUrl(): string {
  const runtime = typeof process !== "undefined" ? process.env.SUPABASE_URL?.trim() : "";
  if (runtime) return runtime;
  return (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
}

export function getPublicSupabaseAnonKey(): string {
  const runtime =
    typeof process !== "undefined" ? process.env.SUPABASE_PUBLISHABLE_KEY?.trim() : "";
  if (runtime) return runtime;
  return (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ?? "";
}

export function assertPublicSupabaseEnv(): { url: string; key: string } {
  const url = getPublicSupabaseUrl();
  const key = getPublicSupabaseAnonKey();
  if (!url || !key) {
    throw new Error(
      "Missing Supabase URL or anon key. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY at build time, and SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY as Worker secrets."
    );
  }
  return { url, key };
}
