-- Booth cooldown between TV sessions (admin-configurable).
ALTER TABLE public.game_config
  ADD COLUMN IF NOT EXISTS session_break_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS session_break_minutes numeric NOT NULL DEFAULT 0.5;

COMMENT ON COLUMN public.game_config.session_break_enabled IS 'When true, TV waits between completed sessions before accepting the next player.';
COMMENT ON COLUMN public.game_config.session_break_minutes IS 'Cooldown duration in minutes (0.5, 1, 2, etc.).';
