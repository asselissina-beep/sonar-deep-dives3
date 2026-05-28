import { createFileRoute } from "@tanstack/react-router";
import { buildHead } from "@/lib/seo";
import { loadGameConfigForRoute } from "@/lib/gameConfig.route";
import RemoteController from "@/components/RemoteController";
import { ClientOnly } from "@/components/ClientOnly";
import { isValidJoinToken, isValidSessionCode } from "@/lib/gameChannel";

interface ControllerSearch {
  session?: string;
  token?: string;
}

export const Route = createFileRoute("/controller")({
  component: ControllerPage,
  validateSearch: (search: Record<string, unknown>): ControllerSearch => {
    const session =
      typeof search.session === "string" ? search.session.toUpperCase() : undefined;
    const token =
      typeof search.token === "string" ? search.token.toLowerCase() : undefined;
    return {
      session: session && isValidSessionCode(session) ? session : undefined,
      token: token && isValidJoinToken(token) ? token : undefined,
    };
  },
  loader: async ({ context: { queryClient } }) => {
    const config = await loadGameConfigForRoute(queryClient);
    return { config };
  },
  head: ({ loaderData }) =>
    buildHead(loaderData?.config ?? null, "controller"),
});

function ControllerPage() {
  const { session, token } = Route.useSearch();
  return (
    <ClientOnly
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background">
          <div className="animate-pulse text-primary text-sm tracking-widest">LOADING...</div>
        </div>
      }
    >
      <RemoteController sessionCode={session} joinToken={token} />
    </ClientOnly>
  );
}
