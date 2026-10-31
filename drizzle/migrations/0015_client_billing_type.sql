-- Tipo de cobrança do cliente: 'mensal' entra no MRR e no LTV; 'pontual' é um serviço avulso (valor do projeto)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS billing_type text NOT NULL DEFAULT 'mensal';
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_billing_type_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_billing_type_check CHECK (billing_type IN ('mensal', 'pontual'));
