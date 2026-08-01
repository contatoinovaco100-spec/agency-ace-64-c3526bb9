CREATE TABLE public.ig_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ig_user_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL DEFAULT '',
  page_id TEXT NOT NULL DEFAULT '',
  page_name TEXT NOT NULL DEFAULT '',
  profile_picture_url TEXT NOT NULL DEFAULT '',
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ig_accounts TO authenticated;
GRANT ALL ON public.ig_accounts TO service_role;
ALTER TABLE public.ig_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage ig accounts" ON public.ig_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER ig_accounts_updated_at BEFORE UPDATE ON public.ig_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ig_publications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caption TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL DEFAULT 'IMAGE',
  media_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  success_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ig_publications TO authenticated;
GRANT ALL ON public.ig_publications TO service_role;
ALTER TABLE public.ig_publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage ig publications" ON public.ig_publications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));