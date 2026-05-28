import type { PlayerRegistration } from "@/lib/admin.server";

export type RegistrationExportColumn = keyof Pick<
  PlayerRegistration,
  | "created_at"
  | "session_code"
  | "first_name"
  | "last_name"
  | "company"
  | "email"
  | "gdpr_consent"
>;

export const REGISTRATION_EXPORT_COLUMNS: {
  key: RegistrationExportColumn;
  label: string;
}[] = [
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "company", label: "Company" },
  { key: "email", label: "Email" },
  { key: "created_at", label: "Registered At" },
  { key: "session_code", label: "Session Code" },
  { key: "gdpr_consent", label: "GDPR Consent" },
];

function formatCell(row: PlayerRegistration, key: RegistrationExportColumn): string {
  const value = row[key];
  if (key === "gdpr_consent") return value ? "yes" : "no";
  if (key === "created_at") {
    try {
      return new Date(value).toISOString();
    } catch {
      return String(value);
    }
  }
  return String(value ?? "");
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function registrationsToCsv(rows: PlayerRegistration[]): string {
  const header = REGISTRATION_EXPORT_COLUMNS.map((c) => escapeCsvField(c.label)).join(",");
  const body = rows.map((row) =>
    REGISTRATION_EXPORT_COLUMNS.map((c) => escapeCsvField(formatCell(row, c.key))).join(",")
  );
  return [header, ...body].join("\r\n");
}

export function registrationsToJson(rows: PlayerRegistration[]): string {
  return JSON.stringify(
    rows.map((row) => {
      const out: Record<string, string | boolean> = {};
      for (const { key, label } of REGISTRATION_EXPORT_COLUMNS) {
        if (key === "gdpr_consent") {
          out[label] = row.gdpr_consent;
        } else {
          out[label] = formatCell(row, key);
        }
      }
      return out;
    }),
    null,
    2
  );
}

export function downloadTextFile(
  contents: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportRegistrationsFilename(
  extension: string,
  prefix = "leads"
): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `${prefix}-${stamp}.${extension}`;
}
