CREATE TABLE IF NOT EXISTS public.vitrine_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cta_url text NOT NULL DEFAULT 'https://api.whatsapp.com/send/?phone=5502481474167',
  instagram_url text NOT NULL DEFAULT 'https://www.instagram.com/inovalab.mov/',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vitrine_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.vitrine_settings TO authenticated;
GRANT ALL ON public.vitrine_settings TO service_role;

ALTER TABLE public.vitrine_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vitrine_settings_public_read" ON public.vitrine_settings;
CREATE POLICY "vitrine_settings_public_read" ON public.vitrine_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "vitrine_settings_admin_write" ON public.vitrine_settings;
CREATE POLICY "vitrine_settings_admin_write" ON public.vitrine_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.vitrine_settings (cta_url)
SELECT 'https://api.whatsapp.com/send/?phone=5502481474167'
WHERE NOT EXISTS (SELECT 1 FROM public.vitrine_settings);