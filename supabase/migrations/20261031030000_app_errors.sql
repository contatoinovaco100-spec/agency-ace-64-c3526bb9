-- Registro automático de erros da plataforma (telas que quebram, falhas de JavaScript).
-- Qualquer pessoa pode registrar (inclusive páginas públicas); só admin lê e apaga.
CREATE TABLE IF NOT EXISTS public.app_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid DEFAULT auth.uid(),
  user_email text CHECK (char_length(user_email) <= 200),
  kind text NOT NULL DEFAULT 'error' CHECK (kind IN ('render', 'error', 'promise', 'chunk')),
  message text NOT NULL CHECK (char_length(message) <= 1000),
  stack text CHECK (char_length(stack) <= 6000),
  path text CHECK (char_length(path) <= 500),
  user_agent text CHECK (char_length(user_agent) <= 400),
  release text CHECK (char_length(release) <= 100)
);

CREATE INDEX IF NOT EXISTS app_errors_created_at_idx ON public.app_errors (created_at DESC);

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Registrar erro" ON public.app_errors;
CREATE POLICY "Registrar erro" ON public.app_errors
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Admin lê erros" ON public.app_errors;
CREATE POLICY "Admin lê erros" ON public.app_errors
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin apaga erros" ON public.app_errors;
CREATE POLICY "Admin apaga erros" ON public.app_errors
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Aviso em tempo real para os admins
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_errors;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
