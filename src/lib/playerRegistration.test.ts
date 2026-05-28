import { describe, expect, it } from "vitest";
import { derivePlayerDisplayName } from "./playerRegistration";

describe("derivePlayerDisplayName", () => {
  it("uses first name truncated to 20 chars", () => {
    expect(derivePlayerDisplayName("Jane", "Doe")).toBe("Jane");
    expect(derivePlayerDisplayName("VeryLongFirstNameHere", "Doe")).toBe("VeryLongFirstNameHer");
  });

  it("falls back to last name or PILOT", () => {
    expect(derivePlayerDisplayName("", "Doe")).toBe("Doe");
    expect(derivePlayerDisplayName("", "")).toBe("PILOT");
  });
});
