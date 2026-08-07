-- Publica posts agendados em background a cada minuto.
-- Requer a edge function `process-scheduled-publish` implantada com
-- verify_jwt = false (já configurado em config.toml).
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('process-scheduled-publish');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'process-scheduled-publish',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cdzzewovtxotkghzeafr.supabase.co/functions/v1/process-scheduled-publish',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'
  );
  $$
);
