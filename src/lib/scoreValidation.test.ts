import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GAMEPLAY_SETTINGS } from "@/lib/gameConfig";
import {
  MIN_GAME_DURATION_MS,
  computeScoreBounds,
  validateScoreSubmission,
} from "@/lib/scoreValidation";

describe("computeScoreBounds", () => {
  it("returns positive caps from default settings", () => {
    const bounds = computeScoreBounds(DEFAULT_GAMEPLAY_SETTINGS);
    expect(bounds.maxScore).toBeGreaterThan(0);
    expect(bounds.maxDepth).toBeGreaterThan(1000);
    expect(bounds.maxWave).toBeGreaterThan(1);
    expect(bounds.maxScore).toBeLessThanOrEqual(999_999);
  });
});

describe("validateScoreSubmission", () => {
  const bounds = computeScoreBounds(DEFAULT_GAMEPLAY_SETTINGS);
  const base = {
    sessionId: "00000000-0000-4000-8000-000000000001",
    sessionCode: "K7W3NP",
    playerName: "PILOT",
    score: 100,
    depth: 1200,
    wave: 2,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a score after minimum duration", () => {
    const started = new Date(Date.now() - MIN_GAME_DURATION_MS - 1000).toISOString();
    expect(() =>
      validateScoreSubmission(base, bounds, started)
    ).not.toThrow();
  });

  it("rejects scores submitted too soon", () => {
    const started = new Date().toISOString();
    expect(() => validateScoreSubmission(base, bounds, started)).toThrow(
      /too soon/i
    );
  });

  it("rejects scores above cap", () => {
    const started = new Date(Date.now() - MIN_GAME_DURATION_MS - 1000).toISOString();
    expect(() =>
      validateScoreSubmission(
        { ...base, score: bounds.maxScore + 1 },
        bounds,
        started
      )
    ).toThrow(/score out of allowed range/i);
  });

  it("rejects invalid wave", () => {
    const started = new Date(Date.now() - MIN_GAME_DURATION_MS - 1000).toISOString();
    expect(() =>
      validateScoreSubmission({ ...base, wave: 0 }, bounds, started)
    ).toThrow(/wave out of allowed range/i);
  });
});
