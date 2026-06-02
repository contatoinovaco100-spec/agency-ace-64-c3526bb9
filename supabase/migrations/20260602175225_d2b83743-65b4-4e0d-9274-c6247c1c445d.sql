
CREATE TABLE IF NOT EXISTS public.affiliate_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number text,
  vsl_video_url text,
  closing_commission numeric DEFAULT 300,
  recurring_commission numeric DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.affiliate_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.affiliate_settings TO authenticated;
GRANT ALL ON public.affiliate_settings TO service_role;

ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read affiliate settings"
  ON public.affiliate_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert affiliate settings"
  ON public.affiliate_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update affiliate settings"
  ON public.affiliate_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete affiliate settings"
  ON public.affiliate_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_affiliate_settings_updated_at
  BEFORE UPDATE ON public.affiliate_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
