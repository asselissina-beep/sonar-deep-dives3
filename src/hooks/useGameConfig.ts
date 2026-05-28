import { useEffect } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { gameConfigQueryKey } from "@/lib/gameConfig.queries";
import { gameConfigQueryOptionsShared } from "@/lib/gameConfig.functions";

/** One Realtime channel for the whole app — multiple hooks must not re-subscribe the same name. */
let configSyncChannel: RealtimeChannel | null = null;
let configSyncRefCount = 0;

function acquireGameConfigSync(queryClient: QueryClient): () => void {
  configSyncRefCount += 1;
  if (!configSyncChannel) {
    configSyncChannel = supabase
      .channel("game-config-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_config" },
        () => {
          void queryClient.invalidateQueries({ queryKey: gameConfigQueryKey });
        }
      )
      .subscribe();
  }
  return () => {
    configSyncRefCount -= 1;
    if (configSyncRefCount <= 0) {
      configSyncRefCount = 0;
      if (configSyncChannel) {
        void supabase.removeChannel(configSyncChannel);
        configSyncChannel = null;
      }
    }
  };
}

export type { GameConfig, GameplaySettings } from "@/lib/gameConfig";
export {
  DEFAULT_GAMEPLAY_SETTINGS,
  DEFAULT_GAME_CONFIG_FIELDS,
  mergeGameplaySettings,
} from "@/lib/gameConfig";

/**
 * Shared game_config via React Query (hydrated from root loader on SSR).
 * Subscribes to DB changes on the client so booth TVs pick up admin edits without reload.
 */
export function useGameConfig() {
  const queryClient = useQueryClient();
  const query = useQuery(gameConfigQueryOptionsShared);

  useEffect(() => acquireGameConfigSync(queryClient), [queryClient]);

  return {
    config: query.data ?? null,
    loading: query.isPending && query.data === undefined,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Call after admin saves so all open tabs refresh immediately. */
export function invalidateGameConfig(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: gameConfigQueryKey });
}
