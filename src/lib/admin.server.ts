import type { GameConfigUpdate } from "@/lib/gameConfig.schema";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { getServiceRoleSupabase } from "@/lib/supabase-service.server";

export type PlayerRegistration = Tables<"player_registrations">;

/** Sync allowlisted emails from ADMIN_BOOTSTRAP_EMAILS into admin_users (service role). */
export async function syncAdminAllowlist(userId: string, email: string): Promise<boolean> {
  const allowlist =
    process.env.ADMIN_BOOTSTRAP_EMAILS?.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean) ?? [];
  if (!allowlist.includes(email.trim().toLowerCase())) {
    return false;
  }

  const supabase = getServiceRoleSupabase();
  const { error } = await supabase.from("admin_users").upsert(
    { user_id: userId, email: email.trim().toLowerCase() },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
  return true;
}

export async function updateConfigInDb(updates: GameConfigUpdate | TablesUpdate<"game_config">) {
  const supabase = getServiceRoleSupabase();
  const { data: rows } = await supabase
    .from("game_config")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!rows) throw new Error("No config found");

  const { data: updated, error } = await supabase
    .from("game_config")
    .update(updates)
    .eq("id", rows.id)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("Update failed — check database permissions");
  return updated;
}

export async function clearAllSessions() {
  const supabase = getServiceRoleSupabase();
  const { error } = await supabase.from("game_sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(error.message);
  return { success: true };
}

/** End a single in-progress session (operator kill switch for stuck booths). */
export async function killGameSessionInDb(sessionId: string): Promise<{ ended: boolean }> {
  const supabase = getServiceRoleSupabase();
  const { data, error } = await supabase
    .from("game_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("status", "playing")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return { ended: !!data };
}

export async function clearAllScores() {
  const supabase = getServiceRoleSupabase();
  const { error } = await supabase.from("game_scores").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(error.message);
  return { success: true };
}

export const LEADS_PAGE_SIZE = 50;

const REGISTRATION_COLUMNS =
  "id, session_code, first_name, last_name, company, email, gdpr_consent, created_at" as const;

export type PlayerRegistrationsPage = {
  rows: PlayerRegistration[];
  total: number;
  page: number;
  pageSize: number;
};

function applyLeadSearch<T extends { or: (filters: string) => T }>(
  query: T,
  search?: string
): T {
  const q = search?.trim();
  if (!q) return query;
  const term = `%${q.replace(/,/g, " ")}%`;
  return query.or(
    `first_name.ilike.${term},last_name.ilike.${term},company.ilike.${term},email.ilike.${term},session_code.ilike.${term}`
  );
}

/** Service-role read — paginated; not exposed to anon/authenticated clients. */
export async function listPlayerRegistrationsPage(
  page: number,
  pageSize: number,
  search?: string
): Promise<PlayerRegistrationsPage> {
  const supabase = getServiceRoleSupabase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("player_registrations")
    .select(REGISTRATION_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false });

  query = applyLeadSearch(query, search);

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);

  return {
    rows: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
  };
}

/** All rows matching search (for export), capped. */
export async function listPlayerRegistrationsForExport(
  search?: string,
  limit = 5000
): Promise<PlayerRegistration[]> {
  const supabase = getServiceRoleSupabase();
  let query = supabase
    .from("player_registrations")
    .select(REGISTRATION_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  query = applyLeadSearch(query, search);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}
