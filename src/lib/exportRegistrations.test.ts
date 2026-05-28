import { describe, expect, it } from "vitest";
import { registrationsToCsv, registrationsToJson } from "@/lib/exportRegistrations";
import type { PlayerRegistration } from "@/lib/admin.server";

const sample: PlayerRegistration[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    session_code: "K7W3NP",
    first_name: "Jane",
    last_name: "Doe",
    company: "Acme, Inc.",
    email: "jane@example.com",
    gdpr_consent: true,
    created_at: "2026-05-15T10:00:00.000Z",
  },
];

describe("exportRegistrations", () => {
  it("escapes commas in CSV", () => {
    const csv = registrationsToCsv(sample);
    expect(csv).toContain('"Acme, Inc."');
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("exports JSON with labeled fields", () => {
    const json = JSON.parse(registrationsToJson(sample)) as Record<string, unknown>[];
    expect(json[0]["First Name"]).toBe("Jane");
    expect(json[0]["GDPR Consent"]).toBe(true);
  });
});
