-- Admin operators: Supabase Auth users listed here or with app_metadata.role = 'admin'.

CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT admin_users_user_id_key UNIQUE (user_id),
  CONSTRAINT admin_users_email_key UNIQUE (email)
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Operators can verify their own admin row; management is via service role / SQL editor.
DROP POLICY IF EXISTS "Admins can read own admin row" ON public.admin_users;
CREATE POLICY "Admins can read own admin row"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.admin_users FROM anon;
GRANT SELECT ON TABLE public.admin_users TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMENT ON TABLE public.admin_users IS
  'Allowlisted Supabase Auth users for /admin. Add rows after creating users in Authentication, or set app_metadata.role=admin on the user.';
