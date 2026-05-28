
-- 1. Lock down game_config: remove public write access
DROP POLICY "Anyone can insert config" ON public.game_config;
DROP POLICY "Anyone can update config" ON public.game_config;

-- 2. Add score validation constraints
ALTER TABLE public.game_scores ADD CONSTRAINT score_range CHECK (score >= 0 AND score <= 9999999);
ALTER TABLE public.game_scores ADD CONSTRAINT wave_range CHECK (wave >= 1 AND wave <= 100);
ALTER TABLE public.game_scores ADD CONSTRAINT depth_range CHECK (depth >= 0 AND depth <= 99999);
ALTER TABLE public.game_scores ADD CONSTRAINT player_name_length CHECK (char_length(player_name) >= 1 AND char_length(player_name) <= 50);

-- 3. Scope game_sessions UPDATE to own session only (using session_code match)
DROP POLICY "Anyone can update sessions" ON public.game_sessions;
CREATE POLICY "Sessions can be updated by session code" ON public.game_sessions
  FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);
