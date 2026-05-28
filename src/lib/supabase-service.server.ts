import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getPublicSupabaseUrl } from "@/lib/supabasePublicEnv";

export function getSupabaseUrl(): string {
  const url = getPublicSupabaseUrl();
  if (!url) throw new Error("Missing Supabase URL");
  return url;
}

/** Service role bypasses RLS — booth persistence and admin writes. */
export function getServiceRoleSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for server-side game operations");
  }
  return createClient<Database>(getSupabaseUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
