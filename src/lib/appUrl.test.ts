import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAppOrigin,
  getAppUrl,
  getConfiguredAppOrigin,
  getDefaultOgImageUrl,
} from "./appUrl";

describe("appUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("getAppOrigin uses fallback when env unset", () => {
    expect(getAppOrigin("https://tv.local")).toBe("https://tv.local");
    expect(getConfiguredAppOrigin()).toBeUndefined();
  });

  it("normalizes VITE_APP_ORIGIN", () => {
    vi.stubEnv("VITE_APP_ORIGIN", "https://game.example.com/booth");
    expect(getConfiguredAppOrigin()).toBe("https://game.example.com");
    expect(getAppUrl()).toBe("https://game.example.com");
    expect(getAppUrl("/scoreboard")).toBe("https://game.example.com/scoreboard");
    expect(getAppOrigin("https://fallback.local")).toBe("https://game.example.com");
  });

  it("getDefaultOgImageUrl reads VITE_OG_IMAGE_URL", () => {
    expect(getDefaultOgImageUrl()).toBeUndefined();
    vi.stubEnv("VITE_OG_IMAGE_URL", "https://cdn.example/og.png");
    expect(getDefaultOgImageUrl()).toBe("https://cdn.example/og.png");
  });
});
