-- Tabela de configurações Pix (uma por agência/admin)
CREATE TABLE public.pix_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_type text NOT NULL DEFAULT 'cpf', -- cpf, cnpj, email, phone, random
  pix_key text NOT NULL DEFAULT '',
  receiver_name text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT 'SAO PAULO',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pix_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read pix_settings"
ON public.pix_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage pix_settings"
ON public.pix_settings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Permitir leitura pública para a página de fatura
CREATE POLICY "Public read pix_settings"
ON public.pix_settings FOR SELECT
TO anon
USING (true);

-- Tabela de faturas
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  client_contact text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'pendente', -- pendente, pago
  custom_message text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  pix_code text NOT NULL DEFAULT '',
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage invoices"
ON public.invoices FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Permitir leitura pública para a página da fatura
CREATE POLICY "Public read invoices"
ON public.invoices FOR SELECT
TO anon
USING (true);

-- Trigger updated_at
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pix_settings_updated_at
BEFORE UPDATE ON public.pix_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir uma config inicial em branco
INSERT INTO public.pix_settings (key_type, pix_key, receiver_name, city)
VALUES ('cpf', '', 'INOVA CO', 'SAO PAULO');