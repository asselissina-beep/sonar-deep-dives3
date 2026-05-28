import { describe, expect, it } from "vitest";
import { DEFAULT_GAMEPLAY_SETTINGS } from "@/lib/gameConfig";
import {
  gameConfigUpdateSchema,
  parseGameConfigRow,
  parseGameConfigUpdates,
  parseGameplaySettings,
} from "@/lib/gameConfig.schema";

describe("parseGameplaySettings", () => {
  it("merges partial JSON with defaults", () => {
    const result = parseGameplaySettings(
      { lives: 5, score_mine: 200 },
      DEFAULT_GAMEPLAY_SETTINGS
    );
    expect(result.lives).toBe(5);
    expect(result.score_mine).toBe(200);
    expect(result.thrust).toBe(DEFAULT_GAMEPLAY_SETTINGS.thrust);
  });

  it("falls back to defaults on invalid input", () => {
    const result = parseGameplaySettings({ lives: -1 }, DEFAULT_GAMEPLAY_SETTINGS);
    expect(result).toEqual(DEFAULT_GAMEPLAY_SETTINGS);
  });
});

describe("parseGameConfigUpdates", () => {
  it("accepts partial branding updates", () => {
    const updates = parseGameConfigUpdates({ game_name: "DEMO" });
    expect(updates.game_name).toBe("DEMO");
  });

  it("rejects unknown keys", () => {
    expect(() =>
      parseGameConfigUpdates({ game_name: "X", hacker_field: true })
    ).toThrow();
  });

  it("rejects empty updates", () => {
    expect(() => parseGameConfigUpdates({})).toThrow(/required/i);
  });

  it("validates gameplay_settings partial", () => {
    const updates = parseGameConfigUpdates({
      gameplay_settings: { lives: 2 },
    });
    expect(updates.gameplay_settings?.lives).toBe(2);
  });
});

describe("parseGameConfigRow", () => {
  it("parses a valid row", () => {
    const config = parseGameConfigRow(
      {
        id: "00000000-0000-4000-8000-000000000099",
        game_name: "TEST",
        gameplay_settings: { lives: 4 },
      },
      {
        fields: {
          game_name: "ABYSSAL",
          title: "T",
          subtitle: "S",
          mission_description: "M",
          controller_header: "H",
          controller_footer: "F",
          umami_website_id: "",
          umami_script_url: "",
          show_logo: true,
          show_slogan: true,
          show_qr_code: true,
          show_share_buttons: true,
          show_mission_description: true,
          show_footer_text: true,
          footer_text: "FT",
          session_break_enabled: true,
          session_break_minutes: 0.5,
        },
        gameplay: DEFAULT_GAMEPLAY_SETTINGS,
      }
    );
    expect(config?.game_name).toBe("TEST");
    expect(config?.gameplay_settings.lives).toBe(4);
  });

  it("returns null for invalid id", () => {
    expect(
      parseGameConfigRow({ id: "not-a-uuid" }, {
        fields: {
          game_name: "ABYSSAL",
          title: "T",
          subtitle: "S",
          mission_description: "M",
          controller_header: "H",
          controller_footer: "F",
          umami_website_id: "",
          umami_script_url: "",
          show_logo: true,
          show_slogan: true,
          show_qr_code: true,
          show_share_buttons: true,
          show_mission_description: true,
          show_footer_text: true,
          footer_text: "FT",
          session_break_enabled: true,
          session_break_minutes: 0.5,
        },
        gameplay: DEFAULT_GAMEPLAY_SETTINGS,
      })
    ).toBeNull();
  });
});

describe("gameConfigUpdateSchema", () => {
  it("matches admin-editable fields only", () => {
    expect(
      gameConfigUpdateSchema.safeParse({ umami_website_id: "site-1" }).success
    ).toBe(true);
  });
});
