-- Booth registration: capture company name alongside contact details.
ALTER TABLE public.player_registrations
  ADD COLUMN IF NOT EXISTS company TEXT NOT NULL DEFAULT '';

DROP POLICY IF EXISTS "Anyone can create registrations" ON public.player_registrations;

CREATE POLICY "Anyone can create registrations"
  ON public.player_registrations
  FOR INSERT
  WITH CHECK (
    gdpr_consent = true
    AND length(trim(first_name)) BETWEEN 1 AND 80
    AND length(trim(last_name)) BETWEEN 1 AND 80
    AND length(trim(company)) BETWEEN 1 AND 120
    AND length(trim(call_sign)) BETWEEN 1 AND 20
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(email) <= 255
  );
