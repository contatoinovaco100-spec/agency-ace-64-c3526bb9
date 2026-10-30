-- lovable-cron-fallback-reviewed: motor de lotes precisa pausar X minutos entre lotes; cadência por minuto preserva o tempo de pausa exato configurado (1440 execuções/dia)
-- Prospecção em lotes: manda N mensagens seguidas (intervalo de segundos), pausa X minutos e repete.
-- O lote é enviado pelo servidor do WhatsApp (que fica ligado), que avisa a função a cada envio.
ALTER TABLE public.prospect_campaigns ADD COLUMN IF NOT EXISTS send_mode text NOT NULL DEFAULT 'um_por_vez'; -- um_por_vez | lotes
ALTER TABLE public.prospect_campaigns ADD COLUMN IF NOT EXISTS batch_size int NOT NULL DEFAULT 20;
ALTER TABLE public.prospect_campaigns ADD COLUMN IF NOT EXISTS batch_min_sec int NOT NULL DEFAULT 8;
ALTER TABLE public.prospect_campaigns ADD COLUMN IF NOT EXISTS batch_max_sec int NOT NULL DEFAULT 20;
ALTER TABLE public.prospect_campaigns ADD COLUMN IF NOT EXISTS batch_pause_min int NOT NULL DEFAULT 5;
-- Lote em andamento no servidor (enquanto não termina, a campanha não começa outro)
ALTER TABLE public.prospect_campaigns ADD COLUMN IF NOT EXISTS batch_running_since timestamptz;

-- O motor passa a rodar a cada minuto (a pausa entre lotes fica precisa)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prospecting') THEN
    PERFORM cron.unschedule('prospecting');
  END IF;
END $$;

SELECT cron.schedule(
  'prospecting',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cdzzewovtxotkghzeafr.supabase.co/functions/v1/prospecting',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{"action":"run"}'
  );
  $$
);
