CREATE TABLE public.player_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code TEXT NOT NULL,
  call_sign TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  gdpr_consent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.player_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create registrations"
  ON public.player_registrations
  FOR INSERT
  WITH CHECK (
    gdpr_consent = true
    AND length(trim(first_name)) BETWEEN 1 AND 80
    AND length(trim(last_name)) BETWEEN 1 AND 80
    AND length(trim(call_sign)) BETWEEN 1 AND 20
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(email) <= 255
  );

CREATE INDEX idx_player_registrations_session_code ON public.player_registrations(session_code);
CREATE INDEX idx_player_registrations_email ON public.player_registrations(email);