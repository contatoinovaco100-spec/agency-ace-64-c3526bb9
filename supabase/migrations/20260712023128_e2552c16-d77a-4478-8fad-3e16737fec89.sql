
CREATE TABLE public.figma_landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  source_type text NOT NULL DEFAULT 'upload',
  figma_json jsonb,
  generated_html text,
  ai_notes jsonb,
  published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.figma_landing_pages TO authenticated;
GRANT ALL ON public.figma_landing_pages TO service_role;

ALTER TABLE public.figma_landing_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage figma landing pages"
  ON public.figma_landing_pages
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER figma_landing_pages_updated_at
  BEFORE UPDATE ON public.figma_landing_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_public_landing_page(_slug text)
RETURNS TABLE(id uuid, slug text, title text, generated_html text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, slug, title, generated_html
  FROM public.figma_landing_pages
  WHERE slug = _slug AND published = true
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_public_landing_page(text) TO anon, authenticated;
