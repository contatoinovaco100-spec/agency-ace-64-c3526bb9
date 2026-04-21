
-- 1) Nova tabela de linktrees (multi)
CREATE TABLE public.linktrees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  avatar_emoji TEXT NOT NULL DEFAULT '🎬',
  client_id UUID,
  theme TEXT NOT NULL DEFAULT 'dark',
  bg_color TEXT NOT NULL DEFAULT '#0a0a0a',
  button_color TEXT NOT NULL DEFAULT '#bff720',
  button_text_color TEXT NOT NULL DEFAULT '#0a0a0a',
  text_color TEXT NOT NULL DEFAULT '#ffffff',
  border_color TEXT NOT NULL DEFAULT '#bff720',
  button_style TEXT NOT NULL DEFAULT 'rounded',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_linktrees_slug ON public.linktrees(slug);
CREATE INDEX idx_linktrees_client_id ON public.linktrees(client_id);

-- 2) Adicionar linktree_id em linktree_links
ALTER TABLE public.linktree_links
  ADD COLUMN linktree_id UUID;

-- 3) Migrar dados existentes: criar linktree "inova" e vincular os links órfãos
INSERT INTO public.linktrees (slug, display_name, bio, avatar_emoji, theme, bg_color, button_color, button_text_color, text_color, border_color)
SELECT
  'inova',
  COALESCE(display_name, 'INOVA Co.'),
  COALESCE(bio, 'Produtora Audiovisual'),
  COALESCE(avatar_emoji, '🎬'),
  'dark',
  '#0a0a0a', '#bff720', '#0a0a0a', '#ffffff', '#bff720'
FROM public.linktree_profile WHERE id = 1
UNION ALL
SELECT 'inova', 'INOVA Co.', 'Produtora Audiovisual', '🎬', 'dark', '#0a0a0a', '#bff720', '#0a0a0a', '#ffffff', '#bff720'
WHERE NOT EXISTS (SELECT 1 FROM public.linktree_profile WHERE id = 1)
LIMIT 1;

-- Vincular todos os links existentes ao linktree "inova"
UPDATE public.linktree_links
SET linktree_id = (SELECT id FROM public.linktrees WHERE slug = 'inova' LIMIT 1)
WHERE linktree_id IS NULL;

-- Tornar linktree_id obrigatório agora
ALTER TABLE public.linktree_links
  ALTER COLUMN linktree_id SET NOT NULL,
  ADD CONSTRAINT linktree_links_linktree_fk FOREIGN KEY (linktree_id) REFERENCES public.linktrees(id) ON DELETE CASCADE;

CREATE INDEX idx_linktree_links_linktree_id ON public.linktree_links(linktree_id);

-- 4) Remover tabela antiga linktree_profile
DROP TABLE IF EXISTS public.linktree_profile;

-- 5) RLS na nova tabela linktrees
ALTER TABLE public.linktrees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view linktrees"
  ON public.linktrees FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can insert linktrees"
  ON public.linktrees FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update linktrees"
  ON public.linktrees FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete linktrees"
  ON public.linktrees FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger reuse
CREATE TRIGGER linktrees_updated_at
  BEFORE UPDATE ON public.linktrees
  FOR EACH ROW EXECUTE FUNCTION public.update_linktree_updated_at();

-- 6) Storage bucket para avatares
INSERT INTO storage.buckets (id, name, public)
VALUES ('linktree-avatars', 'linktree-avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view linktree avatars"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'linktree-avatars');

CREATE POLICY "Admins can upload linktree avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'linktree-avatars' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update linktree avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'linktree-avatars' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete linktree avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'linktree-avatars' AND public.has_role(auth.uid(), 'admin'));
