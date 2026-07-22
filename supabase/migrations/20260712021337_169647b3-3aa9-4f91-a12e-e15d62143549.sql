
CREATE TABLE public.squad_viral_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  post_url TEXT NOT NULL,
  caption TEXT,
  views_count BIGINT NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  posted_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_viral_posts TO authenticated;
GRANT ALL ON public.squad_viral_posts TO service_role;
ALTER TABLE public.squad_viral_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viral posts readable by authenticated" ON public.squad_viral_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "viral posts admin manage" ON public.squad_viral_posts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER update_squad_viral_posts_updated_at BEFORE UPDATE ON public.squad_viral_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.viral_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  min_views BIGINT NOT NULL DEFAULT 50000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.viral_settings TO authenticated;
GRANT ALL ON public.viral_settings TO service_role;
ALTER TABLE public.viral_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viral settings readable by authenticated" ON public.viral_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "viral settings admin manage" ON public.viral_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER update_viral_settings_updated_at BEFORE UPDATE ON public.viral_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.viral_settings (min_views) VALUES (50000);
