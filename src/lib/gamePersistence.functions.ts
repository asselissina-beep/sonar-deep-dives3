import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  abortGameSessionInDb,
  startGameSessionInDb,
  submitValidatedScoreInDb,
} from "@/lib/gamePersistence.server";

const sessionStartSchema = z.object({
  sessionCode: z.string().min(6).max(6),
  playerName: z.string().min(1).max(20),
});

const scoreSubmitSchema = z.object({
  sessionId: z.string().uuid(),
  sessionCode: z.string().min(6).max(6),
  playerName: z.string().min(1).max(20),
  score: z.number().finite(),
  depth: z.number().finite(),
  wave: z.number().finite(),
});

const sessionEndSchema = z.object({
  sessionCode: z.string().min(6).max(6),
  sessionId: z.string().uuid(),
});

/** Booth TV: start a tracked session (service role; no public INSERT on game_sessions). */
export const startGameSession = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof sessionStartSchema>) => {
    return sessionStartSchema.parse(input);
  })
  .handler(async ({ data }) => {
    const sessionId = await startGameSessionInDb(data.sessionCode, data.playerName);
    return { sessionId };
  });

/**
 * Booth TV: submit final score after server-side validation.
 * Binds to session_id, enforces duration and gameplay-derived caps.
 */
export const submitGameScore = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof scoreSubmitSchema>) => {
    return scoreSubmitSchema.parse(input);
  })
  .handler(async ({ data }) => {
    return submitValidatedScoreInDb(data);
  });

/** Booth TV: end session without a score (player left mid-game). */
export const abortGameSession = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof sessionEndSchema>) => {
    return sessionEndSchema.parse(input);
  })
  .handler(async ({ data }) => {
    await abortGameSessionInDb(data.sessionCode, data.sessionId);
    return { ok: true as const };
  });
