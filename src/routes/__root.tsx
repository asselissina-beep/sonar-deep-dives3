import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { useGameConfig } from "@/hooks/useGameConfig";
import { buildHead } from "@/lib/seo";
import { loadGameConfigForRoute } from "@/lib/gameConfig.route";
import type { RouterContext } from "@/router";
import WaterLinkedLogo from "@/components/WaterLinkedLogo";
import { AppBuildVersion } from "@/components/AppBuildVersion";
import { ClientOnly } from "@/components/ClientOnly";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <WaterLinkedLogo width={180} />
        </div>
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Page not found
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  loader: async ({ context: { queryClient } }) => {
    const config = await loadGameConfigForRoute(queryClient);
    return { config };
  },
  head: ({ loaderData }) => ({
    ...buildHead(loaderData?.config ?? null),
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#06b6d4" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@700;800;900&family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap",
      },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { config } = useGameConfig();

  useEffect(() => {
    if (!config?.umami_script_url || !config?.umami_website_id) return;

    const existing = document.querySelector(
      `script[data-website-id="${config.umami_website_id}"]`
    );
    if (existing) return;

    const script = document.createElement("script");
    script.defer = true;
    script.async = true;
    script.src = config.umami_script_url;
    script.setAttribute("data-website-id", config.umami_website_id);
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [config?.umami_script_url, config?.umami_website_id]);

  const footerText = config?.footer_text?.trim();
  const showFooter = config?.show_footer_text !== false && !!footerText;

  return (
    <>
      <Outlet />
      {showFooter && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 py-2 text-center text-[9px] uppercase tracking-[0.3em] text-white/50 bg-gradient-to-t from-black/70 via-black/40 to-transparent"
          style={{ fontFamily: "'Share Tech Mono', monospace" }}
        >
          <span className="pointer-events-auto">{footerText}</span>
        </div>
      )}
      <ClientOnly>
        <AppBuildVersion />
      </ClientOnly>
    </>
  );
}
