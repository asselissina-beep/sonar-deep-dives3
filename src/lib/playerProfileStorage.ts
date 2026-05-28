const PROFILE_KEY = "sonar-player-profile";
const SESSION_REG_PREFIX = "sonar-session-reg-";

export type PlayerProfile = {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  gdprConsent: boolean;
};

function localStore(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function sessionStore(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function isProfileComplete(profile: PlayerProfile): boolean {
  return (
    profile.firstName.trim().length >= 1 &&
    profile.lastName.trim().length >= 1 &&
    profile.company.trim().length >= 1 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(profile.email.trim()) &&
    profile.gdprConsent
  );
}

export function loadPlayerProfile(): PlayerProfile | null {
  const storage = localStore();
  if (!storage) return null;
  try {
    const raw = storage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    if (
      typeof parsed.firstName !== "string" ||
      typeof parsed.lastName !== "string" ||
      typeof parsed.company !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.gdprConsent !== "boolean"
    ) {
      return null;
    }
    return {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      company: parsed.company,
      email: parsed.email,
      gdprConsent: parsed.gdprConsent,
    };
  } catch {
    return null;
  }
}

export function savePlayerProfile(profile: PlayerProfile): void {
  const storage = localStore();
  if (!storage) return;
  storage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function hasRegisteredForSession(sessionCode: string): boolean {
  const storage = sessionStore();
  if (!storage) return false;
  return storage.getItem(`${SESSION_REG_PREFIX}${sessionCode.toUpperCase()}`) === "1";
}

export function markRegisteredForSession(sessionCode: string): void {
  const storage = sessionStore();
  if (!storage) return;
  storage.setItem(`${SESSION_REG_PREFIX}${sessionCode.toUpperCase()}`, "1");
}
