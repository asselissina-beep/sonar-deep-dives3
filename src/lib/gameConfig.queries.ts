import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseGameConfigFromRow, type GameConfig } from "@/lib/gameConfig";
import type { Tables } from "@/integrations/supabase/types";

export const gameConfigQueryKey = ["game-config"] as const;

/** Stale after 1 min; admin/realtime invalidation refreshes sooner. */
export const GAME_CONFIG_STALE_MS = 60_000;

export async function fetchGameConfigFromSupabase(
  supabase: SupabaseClient
): Promise<GameConfig | null> {
  const { data, error } = await supabase
    .from("game_config")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return parseGameConfigFromRow(data as Tables<"game_config"> | null);
}

export function gameConfigQueryOptions(
  queryFn: () => Promise<GameConfig | null>
) {
  return queryOptions({
    queryKey: gameConfigQueryKey,
    queryFn,
    staleTime: GAME_CONFIG_STALE_MS,
    refetchOnWindowFocus: true,
  });
}

/** Prefetch for route loaders (SSR + client navigation). */
export function ensureGameConfig(queryClient: QueryClient, queryFn: () => Promise<GameConfig | null>) {
  return queryClient.ensureQueryData(gameConfigQueryOptions(queryFn));
}

