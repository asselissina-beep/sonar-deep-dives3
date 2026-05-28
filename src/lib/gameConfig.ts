/**
 * Game config defaults and exports.
 * Runtime validation lives in `gameConfig.schema.ts` (Zod).
 */

export type { GameConfig, GameplaySettings, GameConfigUpdate } from "@/lib/gameConfig.schema";
export {
  gameplaySettingsSchema,
  gameplaySettingsPartialSchema,
  gameConfigUpdateSchema,
  gameConfigSchema,
  parseGameplaySettings,
  parseGameConfigUpdates,
  parseGameConfigRow,
} from "@/lib/gameConfig.schema";

import type { GameConfig, GameplaySettings } from "@/lib/gameConfig.schema";
import {
  DEFAULT_SESSION_BREAK_ENABLED,
  DEFAULT_SESSION_BREAK_MINUTES,
} from "@/lib/sessionBreak";
import {
  gameplaySettingsSchema,
  parseGameplaySettings,
  parseGameConfigRow as parseRow,
} from "@/lib/gameConfig.schema";

/** App defaults (authoritative). DB column default JSON may lag — always merge through Zod. */
export const DEFAULT_GAMEPLAY_SETTINGS: GameplaySettings = {
  sub_radius: 20,
  thrust: 300,
  friction: 0.992,
  rotation_speed: 4.2,
  max_hp: 5,
  lives: 3,
  battery_max: 100,
  battery_drain: 1.8,
  battery_recharge: 10,
  torpedo_speed: 420,
  torpedo_cooldown: 0.14,
  torpedo_battery_cost: 2,
  torpedo_life: 2.5,
  sonar_cooldown: 6,
  sonar_max_radius: 600,
  sonar_duration: 7,
  sonar_fov_degrees: 90,
  spawn_base_count: 3,
  spawn_max_count: 14,
  spawn_base_interval: 9,
  spawn_min_interval: 3.5,
  spawn_interval_reduction: 0.4,
  enemy_base_speed: 25,
  enemy_speed_variance: 35,
  enemy_wave_speed_bonus: 4,
  mine_weight: 0.3,
  manta_weight: 0.25,
  swarm_weight: 0.2,
  shipwreck_weight: 0.1,
  beacon_weight: 0.1,
  seafloor_weight: 0.05,
  manta_hp: 3,
  mine_hp: 1,
  swarm_hp: 1,
  shipwreck_hp: 2,
  beacon_hp: 2,
  seafloor_hp: 2,
  score_mine: 150,
  score_manta: 400,
  score_swarm: 100,
  score_shipwreck: 50,
  score_beacon: 200,
  score_seafloor: 75,
  respawn_invincibility: 2.5,
  depth_gain_base: 30,
  depth_gain_variance: 40,
};

/** Branding / UI defaults aligned with initial DB seed. */
export const DEFAULT_GAME_CONFIG_FIELDS: Omit<GameConfig, "id" | "gameplay_settings"> = {
  game_name: "ABYSSAL",
  title: "SONAR FIELD TEST",
  subtitle: "SONAR SENSOR SYSTEMS // FIELD TEST UNIT",
  mission_description:
    "You pilot the Drone ORCA-7, equipped with our latest next-generation sonar array. Navigate the deep ocean, use your sonar to detect and classify threats, and prove our sensors are the best in the field. Every ping counts.",
  controller_header: "SONAR SENSOR SYSTEMS // REMOTE CONTROLLER",
  controller_footer: "SONAR SENSOR SYSTEMS // REMOTE FIELD CONTROLLER",
  umami_website_id: "",
  umami_script_url: "",
  show_logo: true,
  show_slogan: true,
  show_qr_code: true,
  show_share_buttons: true,
  show_mission_description: true,
  show_footer_text: true,
  footer_text: "SONAR FIELD TEST v2.1 // VISIT OUR BOOTH",
  session_break_enabled: DEFAULT_SESSION_BREAK_ENABLED,
  session_break_minutes: DEFAULT_SESSION_BREAK_MINUTES,
};

const PARSE_DEFAULTS = {
  fields: DEFAULT_GAME_CONFIG_FIELDS,
  gameplay: DEFAULT_GAMEPLAY_SETTINGS,
};

/** @deprecated Use `parseGameplaySettings` from schema; kept for admin form merge. */
export function mergeGameplaySettings(partial: unknown): GameplaySettings {
  return parseGameplaySettings(partial, DEFAULT_GAMEPLAY_SETTINGS);
}

/** Normalizes a raw `game_config` row from Supabase into a validated config. */
export function parseGameConfigFromRow(row: unknown): GameConfig | null {
  return parseRow(row, PARSE_DEFAULTS);
}

// Fail fast if defaults drift from the Zod schema
gameplaySettingsSchema.parse(DEFAULT_GAMEPLAY_SETTINGS);
