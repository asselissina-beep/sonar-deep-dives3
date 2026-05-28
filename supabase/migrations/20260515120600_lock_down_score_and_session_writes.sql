-- Booth persistence goes through TanStack Start server functions (service role).
-- Prevents arbitrary score/session rows from the anon client.

DROP POLICY IF EXISTS "Anyone can create scores" ON public.game_scores;

DROP POLICY IF EXISTS "Anyone can create sessions" ON public.game_sessions;

DROP POLICY IF EXISTS "Sessions can be updated by session code" ON public.game_sessions;

-- One official score row per game session (server enforces before insert).
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_scores_session_id_unique
  ON public.game_scores (session_id)
  WHERE session_id IS NOT NULL;
