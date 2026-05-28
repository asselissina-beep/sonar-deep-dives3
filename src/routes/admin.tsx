import { Suspense, lazy } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { buildHead } from "@/lib/seo";
import { loadGameConfigForRoute } from "@/lib/gameConfig.route";
import RoutePageLoader from "@/components/RoutePageLoader";

const AdminPanel = lazy(() => import("@/components/AdminPanel"));

function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-100" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="max-w-sm text-center space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Something went wrong</h1>
        <p className="text-sm text-gray-500">{error.message}</p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">
            Retry
          </button>
          <Link to="/" className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/admin")({
  component: AdminRoute,
  errorComponent: AdminError,
  loader: async ({ context: { queryClient } }) => {
    const config = await loadGameConfigForRoute(queryClient);
    return { config };
  },
  head: ({ loaderData }) =>
    buildHead(loaderData?.config ?? null, "admin"),
});

function AdminRoute() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-gray-100">
          <RoutePageLoader label="Loading admin…" />
        </div>
      }
    >
      <AdminPanel />
    </Suspense>
  );
}
