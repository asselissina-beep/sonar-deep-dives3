import { z } from "zod";
import { appLog } from "@/lib/logger";
import { SESSION_BREAK_MINUTE_OPTIONS } from "@/lib/sessionBreak";

const finite = z.number().finite();

/** Tunable gameplay JSONB — validated on fetch and admin save. */
export const gameplaySettingsSchema = z
  .object({
    sub_radius: finite.positive().max(80),
    thrust: finite.positive().max(2000),
    friction: finite.min(0.5).max(1),
    rotation_speed: finite.positive().max(20),
    max_hp: finite.int().positive().max(100),
    lives: finite.int().positive().max(20),
    battery_max: finite.positive().max(500),
    battery_drain: finite.nonnegative().max(100),
    battery_recharge: finite.nonnegative().max(100),
    torpedo_speed: finite.positive().max(2000),
    torpedo_cooldown: finite.nonnegative().max(30),
    torpedo_battery_cost: finite.nonnegative().max(100),
    torpedo_life: finite.positive().max(30),
    sonar_cooldown: finite.nonnegative().max(120),
    sonar_max_radius: finite.positive().max(5000),
    sonar_duration: finite.positive().max(60),
    sonar_fov_degrees: finite.positive().max(360),
    spawn_base_count: finite.int().positive().max(50),
    spawn_max_count: finite.int().positive().max(100),
    spawn_base_interval: finite.positive().max(120),
    spawn_min_interval: finite.positive().max(120),
    spawn_interval_reduction: finite.nonnegative().max(20),
    enemy_base_speed: finite.nonnegative().max(500),
    enemy_speed_variance: finite.nonnegative().max(500),
    enemy_wave_speed_bonus: finite.nonnegative().max(100),
    mine_weight: finite.nonnegative().max(1),
    manta_weight: finite.nonnegative().max(1),
    swarm_weight: finite.nonnegative().max(1),
    shipwreck_weight: finite.nonnegative().max(1),
    beacon_weight: finite.nonnegative().max(1),
    seafloor_weight: finite.nonnegative().max(1),
    manta_hp: finite.int().positive().max(50),
    mine_hp: finite.int().positive().max(50),
    swarm_hp: finite.int().positive().max(50),
    shipwreck_hp: finite.int().positive().max(50),
    beacon_hp: finite.int().positive().max(50),
    seafloor_hp: finite.int().positive().max(50),
    score_mine: finite.int().nonnegative().max(1_000_000),
    score_manta: finite.int().nonnegative().max(1_000_000),
    score_swarm: finite.int().nonnegative().max(1_000_000),
    score_shipwreck: finite.int().nonnegative().max(1_000_000),
    score_beacon: finite.int().nonnegative().max(1_000_000),
    score_seafloor: finite.int().nonnegative().max(1_000_000),
    respawn_invincibility: finite.nonnegative().max(30),
    depth_gain_base: finite.int().nonnegative().max(10_000),
    depth_gain_variance: finite.int().nonnegative().max(10_000),
  })
  .strict();

export type GameplaySettings = z.infer<typeof gameplaySettingsSchema>;

export const sessionBreakMinutesSchema = z.union([
  z.literal(0.5),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(5),
]);

export const gameplaySettingsPartialSchema = gameplaySettingsSchema.partial();

/** Writable `game_config` columns (admin PATCH). */
export const gameConfigUpdateSchema = z
  .object({
    game_name: z.string().min(1).max(120),
    title: z.string().max(200),
    subtitle: z.string().max(300),
    mission_description: z.string().max(2000),
    controller_header: z.string().max(300),
    controller_footer: z.string().max(300),
    umami_website_id: z.string().max(120),
    umami_script_url: z.string().max(500),
    show_logo: z.boolean(),
    show_slogan: z.boolean(),
    show_qr_code: z.boolean(),
    show_share_buttons: z.boolean(),
    show_mission_description: z.boolean(),
    show_footer_text: z.boolean(),
    footer_text: z.string().max(500),
    session_break_enabled: z.boolean(),
    session_break_minutes: sessionBreakMinutesSchema,
    gameplay_settings: gameplaySettingsPartialSchema,
  })
  .strict()
  .partial();

export type GameConfigUpdate = z.infer<typeof gameConfigUpdateSchema>;

export const gameConfigSchema = z.object({
  id: z.string().uuid(),
  game_name: z.string(),
  title: z.string(),
  subtitle: z.string(),
  mission_description: z.string(),
  controller_header: z.string(),
  controller_footer: z.string(),
  umami_website_id: z.string(),
  umami_script_url: z.string(),
  show_logo: z.boolean(),
  show_slogan: z.boolean(),
  show_qr_code: z.boolean(),
  show_share_buttons: z.boolean(),
  show_mission_description: z.boolean(),
  show_footer_text: z.boolean(),
  footer_text: z.string(),
  session_break_enabled: z.boolean(),
  session_break_minutes: sessionBreakMinutesSchema,
  gameplay_settings: gameplaySettingsSchema,
});

export type GameConfig = z.infer<typeof gameConfigSchema>;

const gameConfigRowSchema = z
  .object({
    id: z.string().uuid(),
    game_name: z.string().optional(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    mission_description: z.string().optional(),
    controller_header: z.string().optional(),
    controller_footer: z.string().optional(),
    umami_website_id: z.string().optional(),
    umami_script_url: z.string().optional(),
    show_logo: z.boolean().optional(),
    show_slogan: z.boolean().optional(),
    show_qr_code: z.boolean().optional(),
    show_share_buttons: z.boolean().optional(),
    show_mission_description: z.boolean().optional(),
    show_footer_text: z.boolean().optional(),
    footer_text: z.string().optional(),
    session_break_enabled: z.boolean().optional(),
    session_break_minutes: z.union([z.number(), z.string()]).optional(),
    gameplay_settings: z.unknown().optional(),
  })
  .passthrough();

function parseSessionBreakMinutesField(
  value: unknown,
  fallback: (typeof SESSION_BREAK_MINUTE_OPTIONS)[number]
): (typeof SESSION_BREAK_MINUTE_OPTIONS)[number] {
  const n = typeof value === "number" ? value : Number(value);
  if (SESSION_BREAK_MINUTE_OPTIONS.includes(n as (typeof SESSION_BREAK_MINUTE_OPTIONS)[number])) {
    return n as (typeof SESSION_BREAK_MINUTE_OPTIONS)[number];
  }
  return fallback;
}

function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}

/** Merge partial JSONB with defaults, then validate all gameplay fields. */
export function parseGameplaySettings(
  input: unknown,
  defaults: GameplaySettings
): GameplaySettings {
  const partial =
    input && typeof input === "object"
      ? gameplaySettingsPartialSchema.safeParse(input)
      : { success: false as const };
  const merged = {
    ...defaults,
    ...(partial.success ? partial.data : {}),
  };
  const result = gameplaySettingsSchema.safeParse(merged);
  if (result.success) return result.data;
  appLog.warn("game-config", "gameplay_settings validation failed, using defaults:", formatZodError(result.error));
  return defaults;
}

/** Validate admin config updates; throws with a readable message on failure. */
export function parseGameConfigUpdates(updates: unknown): GameConfigUpdate {
  const result = gameConfigUpdateSchema.safeParse(updates);
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }
  if (Object.keys(result.data).length === 0) {
    throw new Error("Updates required");
  }
  return result.data;
}

/** Normalize a Supabase `game_config` row into a validated `GameConfig`. */
export function parseGameConfigRow(
  row: unknown,
  defaults: {
    fields: Omit<GameConfig, "id" | "gameplay_settings">;
    gameplay: GameplaySettings;
  }
): GameConfig | null {
  const rowResult = gameConfigRowSchema.safeParse(row);
  if (!rowResult.success) {
    if (row != null) {
      appLog.warn("game-config", "row validation failed:", formatZodError(rowResult.error));
    }
    return null;
  }

  const r = rowResult.data;
  const f = defaults.fields;

  const candidate = {
    id: r.id,
    game_name: r.game_name ?? f.game_name,
    title: r.title ?? f.title,
    subtitle: r.subtitle ?? f.subtitle,
    mission_description: r.mission_description ?? f.mission_description,
    controller_header: r.controller_header ?? f.controller_header,
    controller_footer: r.controller_footer ?? f.controller_footer,
    umami_website_id: r.umami_website_id ?? f.umami_website_id,
    umami_script_url: r.umami_script_url ?? f.umami_script_url,
    show_logo: r.show_logo ?? f.show_logo,
    show_slogan: r.show_slogan ?? f.show_slogan,
    show_qr_code: r.show_qr_code ?? f.show_qr_code,
    show_share_buttons: r.show_share_buttons ?? f.show_share_buttons,
    show_mission_description: r.show_mission_description ?? f.show_mission_description,
    show_footer_text: r.show_footer_text ?? f.show_footer_text,
    footer_text: r.footer_text ?? f.footer_text,
    session_break_enabled: r.session_break_enabled ?? f.session_break_enabled,
    session_break_minutes: parseSessionBreakMinutesField(
      r.session_break_minutes,
      f.session_break_minutes
    ),
    gameplay_settings: parseGameplaySettings(r.gameplay_settings, defaults.gameplay),
  };

  const configResult = gameConfigSchema.safeParse(candidate);
  if (configResult.success) return configResult.data;

  appLog.warn("game-config", "config validation failed:", formatZodError(configResult.error));
  return null;
}
