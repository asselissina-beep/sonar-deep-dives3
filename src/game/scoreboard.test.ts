import { beforeEach, describe, expect, it, vi } from "vitest";
import { getScoreboard, saveScore } from "@/game/scoreboard";

function mockLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  });
  return store;
}

describe("local scoreboard", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mockLocalStorage();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T12:00:00.000Z"));
  });

  it("starts empty", () => {
    expect(getScoreboard()).toEqual([]);
  });

  it("saves and sorts by score descending", () => {
    saveScore(100, 1000, 1, "ALPHA");
    const board = saveScore(500, 2000, 3, "BRAVO");
    expect(board[0].name).toBe("BRAVO");
    expect(board[0].score).toBe(500);
    expect(board[0].isNew).toBe(true);
    expect(board[1].name).toBe("ALPHA");
    expect(board[1].isNew).toBe(false);
  });

  it("keeps only top 10 entries", () => {
    for (let i = 0; i < 12; i++) {
      saveScore(i * 10, 100, 1, `P${i}`);
    }
    expect(getScoreboard()).toHaveLength(10);
    expect(getScoreboard()[0].score).toBe(110);
  });

  it("truncates long player names", () => {
    const board = saveScore(1, 1, 1, "A".repeat(30));
    expect(board[0].name).toHaveLength(20);
  });
});
