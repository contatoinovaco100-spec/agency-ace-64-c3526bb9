-- Lembrete de aprovação pelo WhatsApp: roda seg a sex às 10h de Brasília (13:00 UTC).
-- Cada mensagem (ou cliente sem telefone) fica registrada para a equipe acompanhar no Meu dia.

CREATE TABLE IF NOT EXISTS public.approval_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  task_ids uuid[] NOT NULL DEFAULT '{}',
  phone text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('enviado', 'sem_telefone', 'erro')),
  error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS approval_reminders_created_at_idx ON public.approval_reminders (created_at DESC);

ALTER TABLE public.approval_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view approval reminders" ON public.approval_reminders;
CREATE POLICY "Authenticated can view approval reminders" ON public.approval_reminders
  FOR SELECT TO authenticated USING (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'approval-reminders') THEN
    PERFORM cron.unschedule('approval-reminders');
  END IF;
END $$;

SELECT cron.schedule(
  'approval-reminders',
  '0 13 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://cdzzewovtxotkghzeafr.supabase.co/functions/v1/approval-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'
  );
  $$
);
