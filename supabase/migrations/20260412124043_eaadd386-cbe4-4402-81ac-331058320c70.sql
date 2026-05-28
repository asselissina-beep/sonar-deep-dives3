ALTER TABLE public.game_config
  ADD COLUMN umami_website_id text NOT NULL DEFAULT '',
  ADD COLUMN umami_script_url text NOT NULL DEFAULT '';