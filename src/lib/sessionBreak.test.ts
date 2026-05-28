import { describe, expect, it } from "vitest";
import {
  formatBreakCountdown,
  parseSessionBreakMinutes,
  sessionBreakDurationMs,
} from "./sessionBreak";

describe("sessionBreak", () => {
  it("parses allowed minute values", () => {
    expect(parseSessionBreakMinutes(1)).toBe(1);
    expect(parseSessionBreakMinutes(0.5)).toBe(0.5);
    expect(parseSessionBreakMinutes("bad")).toBe(0.5);
  });

  it("converts minutes to ms", () => {
    expect(sessionBreakDurationMs(0.5)).toBe(30_000);
    expect(sessionBreakDurationMs(2)).toBe(120_000);
  });

  it("formats countdown", () => {
    expect(formatBreakCountdown(90_000)).toBe("1:30");
    expect(formatBreakCountdown(8_000)).toBe("8s");
  });
});
