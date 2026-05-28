import { createFileRoute } from "@tanstack/react-router";
import { getAppUrl } from "@/lib/appUrl";
import { buildHead } from "@/lib/seo";
import { loadGameConfigForRoute } from "@/lib/gameConfig.route";
import SubmarineGame from "@/components/SubmarineGame";
import { ClientOnly } from "@/components/ClientOnly";
import GameLobbySkeleton from "@/components/GameLobbySkeleton";

export const Route = createFileRoute("/")({
  component: Index,
  loader: async ({ context: { queryClient } }) => {
    const config = await loadGameConfigForRoute(queryClient);
    return { config };
  },
  head: ({ loaderData }) => {
    const ogUrl = getAppUrl();
    return buildHead(loaderData?.config ?? null, "game", {
      ...(ogUrl ? { ogUrl } : {}),
      twitterCard: "summary_large_image",
    });
  },
});

function Index() {
  return (
    <ClientOnly fallback={<GameLobbySkeleton />}>
      <SubmarineGame />
    </ClientOnly>
  );
}
