import { QueryClient } from "@tanstack/react-query";
import { GAME_CONFIG_STALE_MS } from "@/lib/gameConfig.queries";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: GAME_CONFIG_STALE_MS,
        retry: 1,
      },
    },
  });
}
