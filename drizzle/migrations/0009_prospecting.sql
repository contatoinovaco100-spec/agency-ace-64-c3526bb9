-- lovable-cron-fallback-reviewed: Requested campaign dispatch timing requires five-minute checks (288 runs/day); lower cadence delays scheduled sends.
-- Prospecção automática: busca empresas no Google (Places API), a IA escreve uma mensagem para cada uma
-- e o WhatsApp de prospecção envia sozinho, com limite por dia e intervalo aleatório. Quem responde vira lead.

CREATE TABLE IF NOT EXISTS public.prospect_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  niche text NOT NULL,                       -- o que buscar no Google ("clínica de estética")
  city text NOT NULL,                        -- onde ("Volta Redonda, RJ")
  session_id text,                           -- número do WhatsApp que envia (vazio = principal)
  pitch text NOT NULL DEFAULT '',            -- o que oferecer / instruções para a IA
  example_message text NOT NULL DEFAULT '',  -- mensagem de referência (a IA varia a partir dela)
  daily_limit int NOT NULL DEFAULT 30,
  min_gap_min int NOT NULL DEFAULT 5,        -- intervalo aleatório entre envios (minutos)
  max_gap_min int NOT NULL DEFAULT 15,
  start_hour int NOT NULL DEFAULT 9,
  end_hour int NOT NULL DEFAULT 18,
  weekdays_only boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT false,
  next_send_at timestamptz,
  last_search_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_campaigns TO authenticated;
GRANT ALL ON public.prospect_campaigns TO service_role;

CREATE TABLE IF NOT EXISTS public.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.prospect_campaigns(id) ON DELETE CASCADE,
  place_id text,
  name text NOT NULL,
  phone text NOT NULL,                       -- só dígitos, com 55
  address text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  rating numeric,
  reviews int,
  website text NOT NULL DEFAULT '',
  maps_url text NOT NULL DEFAULT '',
  -- novo → enviado → respondeu | sem_whatsapp | erro | descartado | nao_quer
  status text NOT NULL DEFAULT 'novo',
  message text NOT NULL DEFAULT '',
  error text NOT NULL DEFAULT '',
  sent_at timestamptz,
  replied_at timestamptz,
  lead_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospects TO authenticated;
GRANT ALL ON public.prospects TO service_role;

-- Nunca aborda a mesma empresa/telefone duas vezes (nem em campanhas diferentes)
CREATE UNIQUE INDEX IF NOT EXISTS prospects_phone_key ON public.prospects (phone);
CREATE UNIQUE INDEX IF NOT EXISTS prospects_place_key ON public.prospects (place_id) WHERE place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS prospects_queue_idx ON public.prospects (campaign_id, status, created_at);

ALTER TABLE public.prospect_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['prospect_campaigns', 'prospects'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated manage %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Authenticated manage %1$s" ON public.%1$I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- Motor da prospecção: a cada 5 minutos envia no máximo 1 mensagem por campanha (respeitando o intervalo)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prospecting') THEN
    PERFORM cron.unschedule('prospecting');
  END IF;
END $$;

SELECT cron.schedule(
  'prospecting',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cdzzewovtxotkghzeafr.supabase.co/functions/v1/prospecting',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{"action":"run"}'
  );
  $$
);
