-- 20260515120000: Revoke public DELETE on sessions and scores
DROP POLICY IF EXISTS "Anyone can delete sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Anyone can delete scores" ON public.game_scores;

-- 20260515120100: Revoke public INSERT/UPDATE on game_config
DROP POLICY IF EXISTS "Anyone can insert config" ON public.game_config;
DROP POLICY IF EXISTS "Anyone can update config" ON public.game_config;

-- 20260515120200: Lock down player_registrations
COMMENT ON TABLE public.player_registrations IS
  'GDPR PII (email, names). anon/authenticated: INSERT only. SELECT/UPDATE/DELETE: service role only.';
REVOKE ALL ON TABLE public.player_registrations FROM anon, authenticated;
GRANT INSERT ON TABLE public.player_registrations TO anon, authenticated;
DROP POLICY IF EXISTS "Anyone can read registrations" ON public.player_registrations;
DROP POLICY IF EXISTS "Anyone can select registrations" ON public.player_registrations;
DROP POLICY IF EXISTS "Anyone can update registrations" ON public.player_registrations;
DROP POLICY IF EXISTS "Anyone can delete registrations" ON public.player_registrations;

-- 20260515120300: Realtime authorization (initial 3-char policy)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all broadcast" ON realtime.messages;
DROP POLICY IF EXISTS "Allow all presence" ON realtime.messages;
DO $migrate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'game_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.game_sessions;
  END IF;
END $migrate$;

-- 20260515120400: Admin users + is_admin()
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT admin_users_user_id_key UNIQUE (user_id),
  CONSTRAINT admin_users_email_key UNIQUE (email)
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read own admin row" ON public.admin_users;
CREATE POLICY "Admins can read own admin row"
  ON public.admin_users FOR SELECT TO authenticated
  USING (user_id = auth.uid());
REVOKE ALL ON TABLE public.admin_users FROM anon;
GRANT SELECT ON TABLE public.admin_users TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
COMMENT ON TABLE public.admin_users IS
  'Allowlisted Supabase Auth users for /admin. Add rows after creating users in Authentication, or set app_metadata.role=admin on the user.';

-- 20260515120500: Realtime policies updated for 6-char session codes
DROP POLICY IF EXISTS "anon can receive game session broadcast" ON realtime.messages;
DROP POLICY IF EXISTS "anon can send game session broadcast" ON realtime.messages;
CREATE POLICY "anon can receive game session broadcast"
ON realtime.messages FOR SELECT TO anon, authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND (SELECT realtime.topic()) ~ '^abyssal_session_[A-HJ-NP-Z2-9]{6}$'
);
CREATE POLICY "anon can send game session broadcast"
ON realtime.messages FOR INSERT TO anon, authenticated
WITH CHECK (
  realtime.messages.extension = 'broadcast'
  AND (SELECT realtime.topic()) ~ '^abyssal_session_[A-HJ-NP-Z2-9]{6}$'
);

-- 20260515120600: Lock down score/session writes
DROP POLICY IF EXISTS "Anyone can create scores" ON public.game_scores;
DROP POLICY IF EXISTS "Anyone can create sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Sessions can be updated by session code" ON public.game_sessions;
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_scores_session_id_unique
  ON public.game_scores (session_id) WHERE session_id IS NOT NULL;

-- 20260515120700: Add game_config to realtime publication
DO $migrate$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'game_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_config;
  END IF;
END $migrate$;