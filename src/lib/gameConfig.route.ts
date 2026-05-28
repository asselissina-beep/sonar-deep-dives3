import type { QueryClient } from "@tanstack/react-query";
import { fetchGameConfig } from "@/lib/gameConfig.functions";
import { ensureGameConfig } from "@/lib/gameConfig.queries";
import type { GameConfig } from "@/lib/gameConfig";

/** Route loaders: prefetch config into React Query (SSR-safe, deduped). */
export async function loadGameConfigForRoute(
  queryClient: QueryClient
): Promise<GameConfig | null> {
  return ensureGameConfig(queryClient, () => fetchGameConfig());
}
