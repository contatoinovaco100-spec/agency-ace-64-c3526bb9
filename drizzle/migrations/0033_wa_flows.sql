CREATE TABLE IF NOT EXISTS public.wa_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Novo fluxo',
  enabled BOOLEAN NOT NULL DEFAULT false,
  session_id TEXT,
  trigger TEXT NOT NULL DEFAULT 'first_reply',
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_flow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES public.wa_flows(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  session_id TEXT NOT NULL DEFAULT 'default',
  lead_id UUID,
  contact_name TEXT NOT NULL DEFAULT '',
  -- ativo = vai rodar em next_at | aguardando = esperando a resposta do contato até next_at | executando | concluido | parado | erro
  status TEXT NOT NULL DEFAULT 'ativo',
  current_step TEXT,
  next_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wa_flow_runs_due ON public.wa_flow_runs (status, next_at);
CREATE INDEX IF NOT EXISTS wa_flow_runs_phone ON public.wa_flow_runs (phone, status);
CREATE INDEX IF NOT EXISTS wa_flow_runs_flow ON public.wa_flow_runs (flow_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_flows TO authenticated;
GRANT ALL ON public.wa_flows TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_flow_runs TO authenticated;
GRANT ALL ON public.wa_flow_runs TO service_role;

ALTER TABLE public.wa_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_flow_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe gerencia os fluxos" ON public.wa_flows;
CREATE POLICY "Equipe gerencia os fluxos" ON public.wa_flows FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Equipe acompanha os fluxos" ON public.wa_flow_runs;
CREATE POLICY "Equipe acompanha os fluxos" ON public.wa_flow_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);