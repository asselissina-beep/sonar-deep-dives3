/** App build label: `YYYY.DD.MM.<build>` (e.g. `2026.17.05.12`). */
export function formatAppBuildVersion(date: Date, buildNumber: number): string {
  const year = date.getFullYear();
  const day = date.getDate();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}.${day}.${month}.${buildNumber}`;
}

declare const __APP_BUILD_VERSION__: string | undefined;

export function getAppBuildVersion(): string {
  if (typeof __APP_BUILD_VERSION__ !== "undefined") {
    return __APP_BUILD_VERSION__;
  }
  return "dev";
}
