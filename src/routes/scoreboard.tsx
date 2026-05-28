import { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getAppUrl } from "@/lib/appUrl";
import { buildHead } from "@/lib/seo";
import { DEFAULT_GAME_CONFIG_FIELDS } from "@/lib/gameConfig";
import { loadGameConfigForRoute } from "@/lib/gameConfig.route";
import RoutePageLoader from "@/components/RoutePageLoader";

const ScoreboardPage = lazy(() => import("@/components/ScoreboardPage"));

export const Route = createFileRoute("/scoreboard")({
  component: ScoreboardRoute,
  loader: async ({ context: { queryClient } }) => {
    const config = await loadGameConfigForRoute(queryClient);
    return { config };
  },
  head: ({ loaderData }) => {
    const ogUrl = getAppUrl("/scoreboard");
    return buildHead(loaderData?.config ?? null, "default", {
      ...(ogUrl ? { ogUrl } : {}),
    });
  },
});

function ScoreboardRoute() {
  const { config } = Route.useLoaderData();
  const gameName = config?.game_name ?? DEFAULT_GAME_CONFIG_FIELDS.game_name;
  const showLogo = config?.show_logo !== false;

  return (
    <Suspense fallback={<RoutePageLoader label="Loading scoreboard…" />}>
      <ScoreboardPage gameName={gameName} showLogo={showLogo} />
    </Suspense>
  );
}
