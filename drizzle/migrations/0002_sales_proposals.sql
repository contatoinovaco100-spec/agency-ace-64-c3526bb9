-- Propostas comerciais publicadas (/proposta/:slug).
-- A migração original (20260324_add_sales_proposals.sql) tinha nome fora do padrão e nunca foi aplicada;
-- esta recria a tabela de forma segura para rodar mais de uma vez.

CREATE TABLE IF NOT EXISTS public.sales_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_sales_proposals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_sales_proposals_updated_at ON public.sales_proposals;
CREATE TRIGGER update_sales_proposals_updated_at
  BEFORE UPDATE ON public.sales_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_sales_proposals_updated_at();

ALTER TABLE public.sales_proposals ENABLE ROW LEVEL SECURITY;

-- O link público da proposta precisa ler sem login
DROP POLICY IF EXISTS "Allow public read access to proposals by slug" ON public.sales_proposals;
CREATE POLICY "Allow public read access to proposals by slug" ON public.sales_proposals
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to manage proposals" ON public.sales_proposals;
CREATE POLICY "Allow authenticated users to manage proposals" ON public.sales_proposals
  FOR ALL TO authenticated USING (true) WITH CHECK (true);