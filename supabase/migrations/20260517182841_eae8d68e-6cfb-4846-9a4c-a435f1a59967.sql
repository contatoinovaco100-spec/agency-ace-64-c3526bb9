
-- AFFILIATES
CREATE TABLE public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  cpf_cnpj TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  instagram TEXT NOT NULL DEFAULT '',
  city_state TEXT NOT NULL DEFAULT '',
  how_found TEXT NOT NULL DEFAULT '',
  sales_experience BOOLEAN NOT NULL DEFAULT false,
  slug TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'em_analise' CHECK (status IN ('em_analise','aprovado','reprovado','suspenso')),
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_affiliates_user_id ON public.affiliates(user_id);
CREATE INDEX idx_affiliates_slug ON public.affiliates(slug);
CREATE INDEX idx_affiliates_status ON public.affiliates(status);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can register as affiliate" ON public.affiliates
  FOR INSERT TO anon, authenticated WITH CHECK (status = 'em_analise');

CREATE POLICY "Affiliates view own" ON public.affiliates
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public view approved by slug" ON public.affiliates
  FOR SELECT TO anon USING (status = 'aprovado' AND slug IS NOT NULL);

CREATE POLICY "Admins update affiliates" ON public.affiliates
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete affiliates" ON public.affiliates
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_affiliates_updated_at BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AFFILIATE LEADS
CREATE TABLE public.affiliate_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  lead_name TEXT NOT NULL,
  whatsapp TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','em_negociacao','convertido','perdido')),
  notes TEXT NOT NULL DEFAULT '',
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_affiliate_leads_affiliate ON public.affiliate_leads(affiliate_id);

ALTER TABLE public.affiliate_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public submit lead via approved affiliate" ON public.affiliate_leads
  FOR INSERT TO anon, authenticated WITH CHECK (
    status = 'novo' AND EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id = affiliate_id AND a.status = 'aprovado'
    )
  );

CREATE POLICY "Affiliate view own leads" ON public.affiliate_leads
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
  );

CREATE POLICY "Admins manage leads" ON public.affiliate_leads
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_affiliate_leads_updated_at BEFORE UPDATE ON public.affiliate_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AFFILIATE CONTRACTS
CREATE TABLE public.affiliate_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.affiliate_leads(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  monthly_value NUMERIC NOT NULL DEFAULT 0,
  signed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('ativo','pendente','cancelado','inadimplente')),
  cancelled_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_affiliate_contracts_affiliate ON public.affiliate_contracts(affiliate_id);

ALTER TABLE public.affiliate_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliate view own contracts" ON public.affiliate_contracts
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
  );

CREATE POLICY "Admins manage contracts" ON public.affiliate_contracts
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_affiliate_contracts_updated_at BEFORE UPDATE ON public.affiliate_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AFFILIATE COMMISSIONS
CREATE TABLE public.affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.affiliate_contracts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('fechamento','recorrencia')),
  amount NUMERIC NOT NULL DEFAULT 0,
  reference_month DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago')),
  paid_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_affiliate_commissions_affiliate ON public.affiliate_commissions(affiliate_id);
CREATE INDEX idx_affiliate_commissions_contract ON public.affiliate_commissions(contract_id);
-- only one recurring commission per contract per month
CREATE UNIQUE INDEX idx_affiliate_commissions_recurring_unique
  ON public.affiliate_commissions(contract_id, reference_month)
  WHERE type = 'recorrencia';
-- only one closing commission per contract
CREATE UNIQUE INDEX idx_affiliate_commissions_closing_unique
  ON public.affiliate_commissions(contract_id)
  WHERE type = 'fechamento';

ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliate view own commissions" ON public.affiliate_commissions
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
  );

CREATE POLICY "Admins manage commissions" ON public.affiliate_commissions
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_affiliate_commissions_updated_at BEFORE UPDATE ON public.affiliate_commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function: generate recurring R$100 commissions for active contracts in given month
CREATE OR REPLACE FUNCTION public.generate_monthly_affiliate_commissions(_month DATE DEFAULT date_trunc('month', now())::date)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas admins podem gerar comissões.';
  END IF;
  FOR r IN
    SELECT id, affiliate_id FROM public.affiliate_contracts WHERE status = 'ativo'
  LOOP
    BEGIN
      INSERT INTO public.affiliate_commissions(affiliate_id, contract_id, type, amount, reference_month, status)
      VALUES (r.affiliate_id, r.id, 'recorrencia', 100, _month, 'pendente');
      v_count := v_count + 1;
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;
  END LOOP;
  RETURN v_count;
END;
$$;
