-- ============================================================
-- CRON: Scrape de views a cada 10 minutos
-- Rodar no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. Garantir extensões
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. CRON: Atualizar views dos posts a cada 10 min
SELECT cron.schedule(
  'scrape-viral-views-every-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://coblfehkclfjofrshlwl.supabase.co/functions/v1/scrape-viral-views',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 3. CRON: Auto-importar posts do Instagram a cada hora
SELECT cron.schedule(
  'auto-import-viral-every-hour',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://coblfehkclfjofrshlwl.supabase.co/functions/v1/auto-import-viral',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================
-- IMPORTANTE: Substitua o Bearer token acima pela sua
-- service_role key do Supabase.
-- Encontre em: Settings > API > service_role
-- ============================================================

-- 4. CRON: Processar publicações agendadas a cada minuto
SELECT cron.schedule(
  'process-scheduled-publish-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://coblfehkclfjofrshlwl.supabase.co/functions/v1/process-scheduled-publish',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Para verificar os crons criados:
SELECT * FROM cron.job;

-- Para remover um cron:
-- SELECT cron.unschedule('scrape-viral-views-every-10min');
-- SELECT cron.unschedule('auto-import-viral-every-hour');
-- SELECT cron.unschedule('process-scheduled-publish-every-minute');
