
-- Add columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS job_title text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Create user_page_access table
CREATE TABLE IF NOT EXISTS public.user_page_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, page_path)
);

CREATE INDEX IF NOT EXISTS idx_user_page_access_user ON public.user_page_access(user_id);

ALTER TABLE public.user_page_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage page access" ON public.user_page_access;
CREATE POLICY "Admins manage page access"
  ON public.user_page_access
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users view own page access" ON public.user_page_access;
CREATE POLICY "Users view own page access"
  ON public.user_page_access
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Security definer function for page access
CREATE OR REPLACE FUNCTION public.has_page_access(_user_id uuid, _path text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_page_access
      WHERE user_id = _user_id AND page_path = _path
    )
$$;
