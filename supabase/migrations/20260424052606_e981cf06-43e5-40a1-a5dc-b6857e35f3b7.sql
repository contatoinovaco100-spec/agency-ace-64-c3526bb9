-- Clientes do programa de indicações
CREATE TABLE public.referral_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indicações feitas por cada cliente
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.referral_clients(id) ON DELETE CASCADE,
  referred_name TEXT NOT NULL,
  referred_whatsapp TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'enviada' CHECK (status IN ('enviada', 'negociacao', 'fechada')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Níveis de premiação configuráveis
CREATE TABLE public.referral_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  required_count INTEGER NOT NULL DEFAULT 1 CHECK (required_count > 0),
  prize_description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indices para performance
CREATE INDEX idx_referrals_client_id ON public.referrals(client_id);
CREATE INDEX idx_referrals_status ON public.referrals(status);
CREATE INDEX idx_referral_clients_token ON public.referral_clients(token);
CREATE INDEX idx_referral_tiers_sort ON public.referral_tiers(sort_order);

-- Habilitar RLS
ALTER TABLE public.referral_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_tiers ENABLE ROW LEVEL SECURITY;

-- Policies referral_clients: leitura pública (necessária para link sem login), admin gerencia
CREATE POLICY "Public read referral clients"
  ON public.referral_clients FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admin manage referral clients"
  ON public.referral_clients FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policies referrals: leitura pública, admin gerencia
CREATE POLICY "Public read referrals"
  ON public.referrals FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admin manage referrals"
  ON public.referrals FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policies referral_tiers: leitura pública, admin gerencia
CREATE POLICY "Public read referral tiers"
  ON public.referral_tiers FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admin manage referral tiers"
  ON public.referral_tiers FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_referral_tiers_updated_at
  BEFORE UPDATE ON public.referral_tiers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.referral_clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.referrals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.referral_tiers;

-- Tiers padrão
INSERT INTO public.referral_tiers (name, required_count, prize_description, sort_order) VALUES
  ('Bronze', 3, 'Brinde exclusivo da Inova', 1),
  ('Prata', 5, '10% de desconto na próxima mensalidade', 2),
  ('Ouro', 10, 'Mês de mensalidade grátis', 3);