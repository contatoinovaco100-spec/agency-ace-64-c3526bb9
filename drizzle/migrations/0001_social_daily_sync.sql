-- Atualização automática das Redes Sociais: roda todo dia às 00:00 de Brasília (03:00 UTC)
-- e registra cada execução para o Dashboard avisar os admins quando der erro.

CREATE TABLE IF NOT EXISTS public.social_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('ok', 'warning', 'error')),
  message text NOT NULL DEFAULT '',
  added integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_sync_runs_created_at_idx ON public.social_sync_runs (created_at DESC);

ALTER TABLE public.social_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view social sync runs" ON public.social_sync_runs;
CREATE POLICY "Authenticated can view social sync runs" ON public.social_sync_runs
  FOR SELECT TO authenticated USING (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'social-daily-sync') THEN
    PERFORM cron.unschedule('social-daily-sync');
  END IF;
END $$;

SELECT cron.schedule(
  'social-daily-sync',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cdzzewovtxotkghzeafr.supabase.co/functions/v1/social-daily-sync',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'
  );
  $$
);