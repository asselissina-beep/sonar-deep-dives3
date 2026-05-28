import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { GameConfig } from "@/lib/gameConfig";
import {
  fetchGameConfigFromSupabase,
  gameConfigQueryOptions,
} from "@/lib/gameConfig.queries";
import { assertPublicSupabaseEnv } from "@/lib/supabasePublicEnv";

export type { GameConfig, GameplaySettings } from "@/lib/gameConfig";
export {
  DEFAULT_GAMEPLAY_SETTINGS,
  DEFAULT_GAME_CONFIG_FIELDS,
  mergeGameplaySettings,
  parseGameConfigFromRow,
} from "@/lib/gameConfig";

/** Server function — same parse/defaults as the client React Query path. */
export const fetchGameConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<GameConfig | null> => {
    const { url, key } = assertPublicSupabaseEnv();
    const supabase = createClient(url, key);
    return fetchGameConfigFromSupabase(supabase);
  }
);

/** Shared React Query options — same key + server fn for SSR loaders and client hooks. */
export const gameConfigQueryOptionsShared = gameConfigQueryOptions(() =>
  fetchGameConfig()
);
