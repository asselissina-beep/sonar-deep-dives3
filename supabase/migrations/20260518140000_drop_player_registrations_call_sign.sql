-- Remove redundant call_sign; in-game label is derived client-side from first/last name.
-- Policy must be dropped first: INSERT WITH CHECK can reference columns and blocks DROP COLUMN.

DROP POLICY IF EXISTS "Anyone can create registrations" ON public.player_registrations;

ALTER TABLE public.player_registrations
  DROP COLUMN IF EXISTS call_sign;

CREATE POLICY "Anyone can create registrations"
  ON public.player_registrations
  FOR INSERT
  WITH CHECK (
    gdpr_consent = true
    AND length(trim(first_name)) BETWEEN 1 AND 80
    AND length(trim(last_name)) BETWEEN 1 AND 80
    AND length(trim(company)) BETWEEN 1 AND 120
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(email) <= 255
  );
