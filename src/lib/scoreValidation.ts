import type { GameplaySettings } from "@/lib/gameConfig.schema";

/** Minimum time from session start before a score can be submitted (anti-instant cheat). */
export const MIN_GAME_DURATION_MS = 8_000;

/** Upper bound on booth session length for cap math (~15 min exhibition dive). */
export const MAX_SESSION_DURATION_MS = 15 * 60 * 1000;

export interface ScoreSubmissionInput {
  sessionId: string;
  sessionCode: string;
  playerName: string;
  score: number;
  depth: number;
  wave: number;
}

export interface ScoreBounds {
  maxScore: number;
  maxDepth: number;
  maxWave: number;
}

/** Exhibition caps derived from admin gameplay settings (generous buffer). */
export function computeScoreBounds(settings: GameplaySettings): ScoreBounds {
  const maxEnemyScore = Math.max(
    settings.score_mine,
    settings.score_manta,
    settings.score_swarm,
    settings.score_shipwreck,
    settings.score_beacon,
    settings.score_seafloor
  );

  const minIntervalSec = Math.max(settings.spawn_min_interval, 1);
  const maxWaves = Math.ceil(MAX_SESSION_DURATION_MS / (minIntervalSec * 1000)) + 2;
  const maxKills = maxWaves * settings.spawn_max_count;

  const maxScore = Math.min(
    999_999,
    Math.ceil(maxKills * maxEnemyScore * 1.25)
  );

  const depthPerKill =
    settings.depth_gain_base + settings.depth_gain_variance;
  const maxDepth = Math.min(
    99_999,
    Math.ceil(1000 + maxKills * depthPerKill * 1.25)
  );

  const maxWave = Math.min(100, maxWaves + 2);

  return { maxScore, maxDepth, maxWave };
}

export function validateScoreSubmission(
  input: ScoreSubmissionInput,
  bounds: ScoreBounds,
  sessionStartedAt: string | null
): void {
  const started = sessionStartedAt ? Date.parse(sessionStartedAt) : NaN;
  if (!Number.isFinite(started)) {
    throw new Error("Session has no start time");
  }

  const elapsed = Date.now() - started;
  if (elapsed < MIN_GAME_DURATION_MS) {
    throw new Error("Score submitted too soon after session start");
  }
  if (elapsed > MAX_SESSION_DURATION_MS) {
    throw new Error("Session expired");
  }

  if (!Number.isFinite(input.score) || input.score < 0 || input.score > bounds.maxScore) {
    throw new Error("Score out of allowed range for this event");
  }
  if (!Number.isFinite(input.depth) || input.depth < 0 || input.depth > bounds.maxDepth) {
    throw new Error("Depth out of allowed range");
  }
  if (!Number.isFinite(input.wave) || input.wave < 1 || input.wave > bounds.maxWave) {
    throw new Error("Wave out of allowed range");
  }
}
