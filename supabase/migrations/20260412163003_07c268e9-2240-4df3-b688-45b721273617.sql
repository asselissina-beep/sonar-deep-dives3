
ALTER TABLE public.game_config
  ADD COLUMN show_logo boolean NOT NULL DEFAULT true,
  ADD COLUMN show_slogan boolean NOT NULL DEFAULT true,
  ADD COLUMN show_qr_code boolean NOT NULL DEFAULT true,
  ADD COLUMN show_share_buttons boolean NOT NULL DEFAULT true,
  ADD COLUMN show_mission_description boolean NOT NULL DEFAULT true;
