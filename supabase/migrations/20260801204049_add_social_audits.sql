CREATE TABLE public.social_audits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  slug TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT 'instagram',
  score INTEGER NOT NULL DEFAULT 0,
  diagnosis JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_audits_slug ON public.social_audits(slug);
CREATE INDEX idx_social_audits_created_at ON public.social_audits(created_at DESC);

ALTER TABLE public.social_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view social audits by slug"
ON public.social_audits FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Authenticated users can create social audits"
ON public.social_audits FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update social audits"
ON public.social_audits FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete social audits"
ON public.social_audits FOR DELETE
TO authenticated
USING (true);

CREATE TRIGGER update_social_audits_updated_at
BEFORE UPDATE ON public.social_audits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
