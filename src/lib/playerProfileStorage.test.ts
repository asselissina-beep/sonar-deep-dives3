import { beforeEach, describe, expect, it } from "vitest";
import {
  hasRegisteredForSession,
  isProfileComplete,
  loadPlayerProfile,
  markRegisteredForSession,
  savePlayerProfile,
} from "./playerProfileStorage";

describe("playerProfileStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("saves and loads profile", () => {
    savePlayerProfile({
      firstName: "Ada",
      lastName: "Lovelace",
      company: "WL",
      email: "ada@work.com",
      gdprConsent: true,
    });
    expect(loadPlayerProfile()?.firstName).toBe("Ada");
  });

  it("validates complete profile", () => {
    expect(
      isProfileComplete({
        firstName: "A",
        lastName: "B",
        company: "C",
        email: "a@b.co",
        gdprConsent: true,
      })
    ).toBe(true);
    expect(
      isProfileComplete({
        firstName: "",
        lastName: "B",
        company: "C",
        email: "a@b.co",
        gdprConsent: true,
      })
    ).toBe(false);
  });

  it("tracks registration per session code", () => {
    markRegisteredForSession("abc123");
    expect(hasRegisteredForSession("abc123")).toBe(true);
    expect(hasRegisteredForSession("xyz999")).toBe(false);
  });
});
