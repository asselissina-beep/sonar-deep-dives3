// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { readFileSync, existsSync } from "node:fs";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

function readAppVersionFile(): string {
  if (!existsSync(".app-version")) {
    return "dev";
  }
  return readFileSync(".app-version", "utf8").trim();
}

const isProd = process.env.NODE_ENV === "production";

export default defineConfig({
  vite: {
    define: {
      __APP_BUILD_VERSION__: JSON.stringify(readAppVersionFile()),
    },
    esbuild: {
      // Strip stray console.log/info/debug from dependencies in production bundles.
      ...(isProd ? { pure: ["console.log", "console.info", "console.debug"] as const } : {}),
    },
  },
});
