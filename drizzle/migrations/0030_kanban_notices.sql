-- Avisos do kanban (/avisos): o admin escreve um banner que aparece no topo do kanban de todo mundo.
CREATE TABLE IF NOT EXISTS public.kanban_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT 'destaque' CHECK (tone IN ('destaque', 'aviso', 'urgente')),
  link TEXT NOT NULL DEFAULT '',
  starts_on DATE,
  ends_on DATE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kanban_notices TO authenticated;
GRANT ALL ON public.kanban_notices TO service_role;

ALTER TABLE public.kanban_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe lê os avisos do kanban" ON public.kanban_notices;
CREATE POLICY "Equipe lê os avisos do kanban" ON public.kanban_notices FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admin gerencia os avisos do kanban" ON public.kanban_notices;
CREATE POLICY "Admin gerencia os avisos do kanban" ON public.kanban_notices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Aviso novo aparece na hora, sem recarregar
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_notices;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;