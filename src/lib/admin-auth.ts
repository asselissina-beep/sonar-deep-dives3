import type { JwtPayload } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function isAdminFromClaims(claims: JwtPayload | Record<string, unknown>): boolean {
  const appMeta =
    (claims as JwtPayload).app_metadata ??
    (claims as Record<string, unknown>).app_metadata;
  if (appMeta && typeof appMeta === "object" && (appMeta as { role?: string }).role === "admin") {
    return true;
  }
  return false;
}

export async function signInAdmin(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data.session;
}

export async function signOutAdmin() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getAdminSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
