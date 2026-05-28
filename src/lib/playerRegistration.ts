/** In-game / leaderboard label derived from registration name (max 20 chars). */
export function derivePlayerDisplayName(firstName: string, lastName: string): string {
  const fn = firstName.trim();
  const ln = lastName.trim();
  if (fn.length > 0) return fn.slice(0, 20);
  if (ln.length > 0) return ln.slice(0, 20);
  return "PILOT";
}
