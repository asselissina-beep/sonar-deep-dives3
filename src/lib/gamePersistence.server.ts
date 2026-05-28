import { DEFAULT_GAMEPLAY_SETTINGS } from "@/lib/gameConfig";
import { fetchGameConfigFromSupabase } from "@/lib/gameConfig.queries";
import { getServiceRoleSupabase } from "@/lib/supabase-service.server";
import {
  computeScoreBounds,
  validateScoreSubmission,
  type ScoreSubmissionInput,
} from "@/lib/scoreValidation";

const SESSION_CODE_RE = /^[A-Z2-9]{6}$/;

function normalizeName(name: string): string {
  return name.trim().slice(0, 20) || "PILOT";
}

function assertSessionCode(code: string): string {
  const upper = code.toUpperCase();
  if (!SESSION_CODE_RE.test(upper)) {
    throw new Error("Invalid session code");
  }
  return upper;
}

export async function startGameSessionInDb(
  sessionCode: string,
  playerName: string
): Promise<string> {
  const code = assertSessionCode(sessionCode);
  const name = normalizeName(playerName);
  const supabase = getServiceRoleSupabase();

  const { data, error } = await supabase
    .from("game_sessions")
    .insert({
      session_code: code,
      player_name: name,
      status: "playing",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Session insert returned no id");
  return data.id;
}

export async function endGameSessionInDb(
  sessionCode: string,
  sessionId: string
): Promise<void> {
  const code = assertSessionCode(sessionCode);
  const supabase = getServiceRoleSupabase();

  const { error } = await supabase
    .from("game_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("session_code", code)
    .eq("status", "playing");

  if (error) throw new Error(error.message);
}

export async function submitValidatedScoreInDb(
  input: ScoreSubmissionInput
): Promise<{ ok: true }> {
  const code = assertSessionCode(input.sessionCode);
  const name = normalizeName(input.playerName);
  const supabase = getServiceRoleSupabase();

  const { data: session, error: sessionError } = await supabase
    .from("game_sessions")
    .select("id, session_code, player_name, status, started_at")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error("Session not found");
  if (session.status !== "playing") throw new Error("Session is not active");
  if (session.session_code !== code) throw new Error("Session code mismatch");
  if ((session.player_name ?? "").toUpperCase() !== name.toUpperCase()) {
    throw new Error("Player name mismatch");
  }

  const { data: existingScore } = await supabase
    .from("game_scores")
    .select("id")
    .eq("session_id", input.sessionId)
    .maybeSingle();

  if (existingScore) throw new Error("Score already recorded for this session");

  const config = await fetchGameConfigFromSupabase(supabase);
  const bounds = computeScoreBounds(
    config?.gameplay_settings ?? DEFAULT_GAMEPLAY_SETTINGS
  );

  validateScoreSubmission(
    { ...input, sessionCode: code, playerName: name },
    bounds,
    session.started_at
  );

  const { error: scoreError } = await supabase.from("game_scores").insert({
    session_id: input.sessionId,
    session_code: code,
    player_name: name,
    score: Math.floor(input.score),
    depth: Math.floor(input.depth),
    wave: Math.floor(input.wave),
  });

  if (scoreError) throw new Error(scoreError.message);

  await endGameSessionInDb(code, input.sessionId);
  return { ok: true };
}

export async function abortGameSessionInDb(
  sessionCode: string,
  sessionId: string
): Promise<void> {
  const code = assertSessionCode(sessionCode);
  const supabase = getServiceRoleSupabase();

  const { error } = await supabase
    .from("game_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("session_code", code)
    .eq("status", "playing");

  if (error) throw new Error(error.message);
}
