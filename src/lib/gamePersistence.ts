import { appLog } from "@/lib/logger";
import {
  abortGameSession,
  startGameSession,
  submitGameScore,
} from "@/lib/gamePersistence.functions";

const RETRY_DELAY_MS = 400;

function logPersistenceError(context: string, error: unknown) {
  appLog.error("game-persistence", context, error);
}

async function retryOnce<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await fn();
    } catch (error) {
      logPersistenceError(`${label} (attempt ${attempt}/2)`, error);
      if (attempt === 2) return null;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  return null;
}

/** Creates a playing session row; returns UUID for score FK. */
export async function persistSessionStart(
  sessionCode: string,
  playerName: string
): Promise<string | null> {
  return retryOnce("session start", async () => {
    const { sessionId } = await startGameSession({
      data: { sessionCode, playerName },
    });
    return sessionId;
  });
}

/** Persists final score (validated server-side) and marks the session ended. */
export async function persistGameOver(
  sessionCode: string,
  sessionId: string | null,
  playerName: string,
  score: number,
  depth: number,
  wave: number
): Promise<boolean> {
  if (!sessionId) {
    logPersistenceError("score submit", new Error("Missing session id"));
    return false;
  }

  const result = await retryOnce("score submit", async () => {
    await submitGameScore({
      data: { sessionId, sessionCode, playerName, score, depth, wave },
    });
    return true;
  });

  return result !== null;
}

/** Ends an in-progress session when the player leaves without game over. */
export async function persistSessionAbort(
  sessionCode: string,
  sessionId: string | null
): Promise<void> {
  if (!sessionId) return;

  await retryOnce("session abort", async () => {
    await abortGameSession({ data: { sessionCode, sessionId } });
    return true;
  });
}
