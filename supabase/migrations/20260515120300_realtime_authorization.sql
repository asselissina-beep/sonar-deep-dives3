-- Realtime authorization: restrict Broadcast/Presence to game session topics only.
-- Requires client channels to use config.private = true (see src/lib/gameChannel.ts).
-- In Supabase Dashboard → Realtime → Settings: disable "Allow public access" when enforced.

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Remove any overly broad policies if present.
DROP POLICY IF EXISTS "Allow all broadcast" ON realtime.messages;
DROP POLICY IF EXISTS "Allow all presence" ON realtime.messages;

-- Game session channels: abyssal_session_{3-char code} (matches generateSessionCode charset).
DROP POLICY IF EXISTS "anon can receive game session broadcast" ON realtime.messages;
DROP POLICY IF EXISTS "anon can send game session broadcast" ON realtime.messages;

CREATE POLICY "anon can receive game session broadcast"
ON realtime.messages
FOR SELECT
TO anon, authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND (SELECT realtime.topic()) ~ '^abyssal_session_[A-HJ-NP-Z2-9]{3}$'
);

CREATE POLICY "anon can send game session broadcast"
ON realtime.messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  realtime.messages.extension = 'broadcast'
  AND (SELECT realtime.topic()) ~ '^abyssal_session_[A-HJ-NP-Z2-9]{3}$'
);

-- Postgres Changes: session rows are not public leaderboard data; stop broadcasting them.
-- Admin polls sessions; scoreboard still receives game_scores via table RLS + publication.
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
