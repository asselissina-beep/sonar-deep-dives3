
CREATE TABLE public.game_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_name TEXT NOT NULL DEFAULT 'ABYSSAL',
  title TEXT NOT NULL DEFAULT 'SONAR FIELD TEST',
  subtitle TEXT NOT NULL DEFAULT 'SONAR SENSOR SYSTEMS // FIELD TEST UNIT',
  mission_description TEXT NOT NULL DEFAULT 'You pilot the Drone ORCA-7, equipped with our latest next-generation sonar array. Navigate the deep ocean, use your sonar to detect and classify threats, and prove our sensors are the best in the field. Every ping counts.',
  controller_header TEXT NOT NULL DEFAULT 'SONAR SENSOR SYSTEMS // REMOTE CONTROLLER',
  controller_footer TEXT NOT NULL DEFAULT 'SONAR SENSOR SYSTEMS // REMOTE FIELD CONTROLLER',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.game_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read config" ON public.game_config FOR SELECT USING (true);
CREATE POLICY "Anyone can update config" ON public.game_config FOR UPDATE USING (true);
CREATE POLICY "Anyone can insert config" ON public.game_config FOR INSERT WITH CHECK (true);

-- Seed default config
INSERT INTO public.game_config (game_name, title, subtitle, mission_description, controller_header, controller_footer)
VALUES ('ABYSSAL', 'SONAR FIELD TEST', 'SONAR SENSOR SYSTEMS // FIELD TEST UNIT',
  'You pilot the Drone ORCA-7, equipped with our latest next-generation sonar array. Navigate the deep ocean, use your sonar to detect and classify threats, and prove our sensors are the best in the field. Every ping counts.',
  'SONAR SENSOR SYSTEMS // REMOTE CONTROLLER',
  'SONAR SENSOR SYSTEMS // REMOTE FIELD CONTROLLER');
