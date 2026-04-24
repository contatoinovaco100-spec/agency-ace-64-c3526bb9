-- ============== TABELAS ==============

CREATE TABLE public.rede_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID,
  name TEXT NOT NULL,
  logo_url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  niche TEXT NOT NULL DEFAULT '',
  services TEXT[] NOT NULL DEFAULT '{}',
  city TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rede_companies_owner ON public.rede_companies(owner_user_id);
CREATE INDEX idx_rede_companies_active ON public.rede_companies(is_active);

CREATE TABLE public.rede_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.rede_companies(id) ON DELETE CASCADE,
  author_user_id UUID,
  content TEXT NOT NULL DEFAULT '',
  media_url TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL DEFAULT '', -- 'image' | 'video' | ''
  post_type TEXT NOT NULL DEFAULT 'atualizacao', -- 'atualizacao' | 'oferecendo' | 'procurando'
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rede_posts_company ON public.rede_posts(company_id);
CREATE INDEX idx_rede_posts_created ON public.rede_posts(created_at DESC);
CREATE INDEX idx_rede_posts_visible ON public.rede_posts(is_hidden, created_at DESC);

-- ============== TRIGGERS updated_at ==============

CREATE TRIGGER trg_rede_companies_updated
BEFORE UPDATE ON public.rede_companies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_rede_posts_updated
BEFORE UPDATE ON public.rede_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== TRIGGER: limite de 10 posts/dia ==============

CREATE OR REPLACE FUNCTION public.enforce_rede_posts_daily_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  -- admin não tem limite
  IF NEW.author_user_id IS NOT NULL AND public.has_role(NEW.author_user_id, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.rede_posts
  WHERE company_id = NEW.company_id
    AND created_at >= date_trunc('day', now());

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'Limite diário de 10 publicações atingido para esta empresa.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rede_posts_daily_limit
BEFORE INSERT ON public.rede_posts
FOR EACH ROW EXECUTE FUNCTION public.enforce_rede_posts_daily_limit();

-- ============== RLS ==============

ALTER TABLE public.rede_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rede_posts ENABLE ROW LEVEL SECURITY;

-- Empresas: público lê ativas; admin gerencia tudo; dono lê/atualiza a sua
CREATE POLICY "Public read active companies"
ON public.rede_companies FOR SELECT
TO anon, authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = owner_user_id);

CREATE POLICY "Admin manage companies"
ON public.rede_companies FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner update own company"
ON public.rede_companies FOR UPDATE
TO authenticated
USING (auth.uid() = owner_user_id)
WITH CHECK (auth.uid() = owner_user_id);

-- Posts: público lê não ocultos; admin gerencia tudo; dono cria/edita seus posts
CREATE POLICY "Public read visible posts"
ON public.rede_posts FOR SELECT
TO anon, authenticated
USING (
  is_hidden = false
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = author_user_id
);

CREATE POLICY "Admin manage posts"
ON public.rede_posts FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner insert own post"
ON public.rede_posts FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = author_user_id
  AND EXISTS (
    SELECT 1 FROM public.rede_companies c
    WHERE c.id = company_id AND c.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Owner update own post"
ON public.rede_posts FOR UPDATE
TO authenticated
USING (auth.uid() = author_user_id)
WITH CHECK (auth.uid() = author_user_id AND is_hidden = false AND is_featured = (SELECT is_featured FROM public.rede_posts p WHERE p.id = rede_posts.id));

-- ============== STORAGE ==============

INSERT INTO storage.buckets (id, name, public)
VALUES ('rede-media', 'rede-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read rede-media"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'rede-media');

CREATE POLICY "Auth upload rede-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'rede-media');

CREATE POLICY "Auth update own rede-media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'rede-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Auth delete own rede-media or admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'rede-media'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::app_role))
);