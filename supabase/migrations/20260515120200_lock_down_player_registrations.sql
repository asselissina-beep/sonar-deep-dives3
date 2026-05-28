-- GDPR PII: visitors may INSERT only. No public read/update/delete.
-- Admin export uses SUPABASE_SERVICE_ROLE_KEY via server functions (bypasses RLS).

COMMENT ON TABLE public.player_registrations IS
  'GDPR PII (email, names). anon/authenticated: INSERT only. SELECT/UPDATE/DELETE: service role only.';

-- Defense in depth: table privileges match RLS intent (prevents accidental broad policies).
REVOKE ALL ON TABLE public.player_registrations FROM anon, authenticated;
GRANT INSERT ON TABLE public.player_registrations TO anon, authenticated;

-- Remove any permissive policies if they were added later.
DROP POLICY IF EXISTS "Anyone can read registrations" ON public.player_registrations;
DROP POLICY IF EXISTS "Anyone can select registrations" ON public.player_registrations;
DROP POLICY IF EXISTS "Anyone can update registrations" ON public.player_registrations;
DROP POLICY IF EXISTS "Anyone can delete registrations" ON public.player_registrations;

-- INSERT policy "Anyone can create registrations" remains from 20260515094833 migration.
