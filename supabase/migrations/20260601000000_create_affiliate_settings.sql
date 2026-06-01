CREATE TABLE IF NOT EXISTS public.affiliate_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp_number TEXT NOT NULL DEFAULT '5588994463203',
  vsl_video_url TEXT NOT NULL DEFAULT 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  closing_commission NUMERIC NOT NULL DEFAULT 300,
  recurring_commission NUMERIC NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.affiliate_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert settings" ON public.affiliate_settings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update settings" ON public.affiliate_settings
  FOR UPDATE USING (true);

-- Insert default row
INSERT INTO public.affiliate_settings (whatsapp_number, vsl_video_url, closing_commission, recurring_commission)
VALUES ('5588994463203', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 300, 100);
