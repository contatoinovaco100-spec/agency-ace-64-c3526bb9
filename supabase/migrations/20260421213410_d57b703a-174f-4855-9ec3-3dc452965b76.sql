
CREATE TABLE public.linktree_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🔗',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.linktree_profile (
  id INTEGER PRIMARY KEY DEFAULT 1,
  display_name TEXT NOT NULL DEFAULT 'INOVA Co.',
  bio TEXT NOT NULL DEFAULT 'Produtora Audiovisual',
  avatar_emoji TEXT NOT NULL DEFAULT '🎬',
  avatar_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);

INSERT INTO public.linktree_profile (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.linktree_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linktree_profile ENABLE ROW LEVEL SECURITY;

-- Public read (linktree is a public page)
CREATE POLICY "Anyone can view linktree links"
  ON public.linktree_links FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can view linktree profile"
  ON public.linktree_profile FOR SELECT TO anon, authenticated USING (true);

-- Anyone can increment clicks (public counter)
CREATE POLICY "Anyone can update click count"
  ON public.linktree_links FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Only admins manage links/profile
CREATE POLICY "Admins can insert linktree links"
  ON public.linktree_links FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete linktree links"
  ON public.linktree_links FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update linktree profile"
  ON public.linktree_profile FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert linktree profile"
  ON public.linktree_profile FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_linktree_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER linktree_links_updated_at
  BEFORE UPDATE ON public.linktree_links
  FOR EACH ROW EXECUTE FUNCTION public.update_linktree_updated_at();

CREATE TRIGGER linktree_profile_updated_at
  BEFORE UPDATE ON public.linktree_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_linktree_updated_at();

-- Seed default links
INSERT INTO public.linktree_links (title, url, icon, sort_order) VALUES
  ('Instagram', 'https://instagram.com/inovaco100', '📸', 1),
  ('YouTube', 'https://youtube.com/@inovaco100', '▶️', 2),
  ('WhatsApp', 'https://wa.me/5562999999999', '💬', 3),
  ('Site', 'https://inovaco.com.br', '🌐', 4),
  ('Portfólio', 'https://agency-ace-64.lovable.app/vitrine', '🎬', 5);
