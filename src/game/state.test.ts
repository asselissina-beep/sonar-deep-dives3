import { describe, expect, it } from "vitest";
import { DEFAULT_GAMEPLAY_SETTINGS } from "@/lib/gameConfig";
import {
  createInitialState,
  dist,
  pickObstacleKind,
  resetObstacleIds,
  wrap,
} from "@/game/state";

describe("wrap", () => {
  it("wraps coordinates within canvas bounds", () => {
    expect(wrap({ x: -10, y: 5 }, 100, 50)).toEqual({ x: 90, y: 5 });
    expect(wrap({ x: 110, y: 60 }, 100, 50)).toEqual({ x: 10, y: 10 });
  });
});

describe("dist", () => {
  it("returns euclidean distance", () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("pickObstacleKind", () => {
  const weights = {
    mine_weight: 0.3,
    manta_weight: 0.25,
    swarm_weight: 0.2,
    shipwreck_weight: 0.1,
    beacon_weight: 0.1,
    seafloor_weight: 0.05,
  };

  it("selects mine at start of range", () => {
    expect(pickObstacleKind(0, weights)).toBe("mine");
  });

  it("selects manta in second bucket", () => {
    expect(pickObstacleKind(0.31 / 1, weights)).toBe("manta");
  });

  it("selects seafloor at end of range", () => {
    expect(pickObstacleKind(0.999, weights)).toBe("seafloor");
  });

  it("defaults to mine when all weights are zero", () => {
    expect(
      pickObstacleKind(0.5, {
        mine_weight: 0,
        manta_weight: 0,
        swarm_weight: 0,
        shipwreck_weight: 0,
        beacon_weight: 0,
        seafloor_weight: 0,
      })
    ).toBe("mine");
  });
});

describe("createInitialState", () => {
  it("initializes from gameplay settings", () => {
    resetObstacleIds();
    const gs = createInitialState(800, 600, DEFAULT_GAMEPLAY_SETTINGS);
    expect(gs.lives).toBe(DEFAULT_GAMEPLAY_SETTINGS.lives);
    expect(gs.sub.maxHp).toBe(DEFAULT_GAMEPLAY_SETTINGS.max_hp);
    expect(gs.gameOver).toBe(false);
    expect(gs.settings.thrust).toBe(DEFAULT_GAMEPLAY_SETTINGS.thrust);
  });
});
