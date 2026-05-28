-- Revoke anonymous INSERT/UPDATE on game_config.
-- Public read remains ("Anyone can read config"). Writes use service role via admin server functions.

DROP POLICY IF EXISTS "Anyone can insert config" ON public.game_config;
DROP POLICY IF EXISTS "Anyone can update config" ON public.game_config;
