-- Booth TVs listen for admin branding edits via postgres_changes (useGameConfig).
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
