export interface ScoreEntry {
  score: number;
  depth: number;
  wave: number;
  date: string;
  name: string;
  isNew?: boolean;
}

const SCOREBOARD_KEY = "abyssal_scoreboard";

export function getScoreboard(): ScoreEntry[] {
  try {
    const data = localStorage.getItem(SCOREBOARD_KEY);
    if (!data) return [];
    return JSON.parse(data) as ScoreEntry[];
  } catch {
    return [];
  }
}

export function saveScore(
  score: number,
  depth: number,
  wave: number,
  name: string = "PILOT"
): ScoreEntry[] {
  const entries: ScoreEntry[] = getScoreboard().map(e => ({ ...e, isNew: false }));
  const newEntry: ScoreEntry = {
    score, depth, wave, name: name.slice(0, 20) || "PILOT",
    date: new Date().toISOString().split("T")[0],
    isNew: true,
  };
  entries.push(newEntry);
  entries.sort((a, b) => b.score - a.score);
  const top = entries.slice(0, 10);
  try {
    localStorage.setItem(SCOREBOARD_KEY, JSON.stringify(top));
  } catch {
    // localStorage may be unavailable (private mode, quota).
  }
  return top;
}