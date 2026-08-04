-- Habilita extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove job anterior se existir
SELECT cron.unschedule('process-scheduled-publish');

-- Cria cron job que processa publicações agendadas a cada 1 minuto
SELECT cron.schedule(
  'process-scheduled-publish',
  '* * * * *',
  $$
    SELECT net.http_post(
      url    := 'https://coblfehkclfjofrshlwl.supabase.co/functions/v1/process-scheduled-publish',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body   := '{}'::jsonb
    );
  $$
);
