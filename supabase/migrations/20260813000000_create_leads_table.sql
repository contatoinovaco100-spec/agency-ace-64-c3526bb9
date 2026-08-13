CREATE TABLE IF NOT EXISTS public.leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj TEXT UNIQUE NOT NULL,
  razao_social TEXT,
  nome_fantasia TEXT,
  atividade_principal TEXT,
  telefone TEXT,
  email TEXT,
  bairro TEXT,
  municipio TEXT,
  uf TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  cep TEXT,
  porte TEXT,
  capital_social TEXT,
  data_abertura TEXT,
  natureza_juridica TEXT,
  situacao_cadastral TEXT,
  source TEXT DEFAULT 'consulta-cnpj',
  status TEXT DEFAULT 'novo',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON public.leads FOR ALL USING (true);
