import { describe, expect, it } from "vitest";
import { formatAppBuildVersion, getAppBuildVersion } from "./buildVersion";

describe("formatAppBuildVersion", () => {
  it("formats as YYYY.DD.MM.build", () => {
    expect(formatAppBuildVersion(new Date(2026, 4, 17, 12, 0, 0), 12)).toBe(
      "2026.17.05.12"
    );
  });

  it("zero-pads month only", () => {
    expect(formatAppBuildVersion(new Date(2026, 0, 5), 1)).toBe("2026.5.01.1");
  });
});

describe("getAppBuildVersion", () => {
  it("returns injected build version in tests", () => {
    expect(getAppBuildVersion()).toBe("test");
  });
});
