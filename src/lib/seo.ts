/**
 * Shared SEO / head-meta helpers.
 * Derives all values from the GameConfig fetched at route level.
 */

import type { GameConfig } from "@/lib/gameConfig";
import { getDefaultOgImageUrl } from "@/lib/appUrl";

export type PageVariant = "game" | "controller" | "admin" | "default";

interface HeadOverrides {
  ogUrl?: string;
  ogImage?: string;
  twitterCard?: "summary" | "summary_large_image";
}

function resolveOgImage(override?: string): string | undefined {
  return override ?? getDefaultOgImageUrl();
}

/**
 * Build head() meta from the DB config + a page variant.
 * No hardcoded game names — everything flows from config.
 */
export function buildHead(
  config: GameConfig | null,
  variant: PageVariant = "default",
  overrides: HeadOverrides = {},
) {
  const gameName = config?.game_name ?? "Game";
  const missionDesc = config?.mission_description ?? "";
  const subtitle = config?.subtitle ?? "";
  const controllerHeader = config?.controller_header ?? "";

  const titles: Record<PageVariant, string> = {
    game: `${gameName} — ${subtitle || "Play Now"}`,
    controller: `${gameName} Controller — ${controllerHeader || "Remote Play"}`,
    admin: `${gameName} Admin — Session & Score Management`,
    default: gameName,
  };

  const descriptions: Record<PageVariant, string> = {
    game: missionDesc || subtitle || `Play ${gameName}`,
    controller: controllerHeader
      ? `Remote controller for ${gameName}. ${controllerHeader}`
      : `Use your phone as a joystick for ${gameName}.`,
    admin: `Admin panel for monitoring ${gameName} sessions and scoreboards.`,
    default: subtitle || missionDesc || gameName,
  };

  const title = titles[variant];
  const description = descriptions[variant];
  const ogImage = resolveOgImage(overrides.ogImage);

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "author", content: gameName },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      ...(overrides.ogUrl
        ? [{ property: "og:url", content: overrides.ogUrl }]
        : []),
      ...(ogImage ? [{ property: "og:image", content: ogImage }] : []),
      {
        name: "twitter:card",
        content: overrides.twitterCard ?? "summary",
      },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      ...(ogImage ? [{ name: "twitter:image", content: ogImage }] : []),
    ],
  };
}
