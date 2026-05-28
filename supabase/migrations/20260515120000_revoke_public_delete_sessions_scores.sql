-- Revoke anonymous DELETE on sessions and scores.
-- Admin resets use server functions with SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).

DROP POLICY IF EXISTS "Anyone can delete sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Anyone can delete scores" ON public.game_scores;
