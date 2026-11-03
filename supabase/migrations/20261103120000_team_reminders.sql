-- Lembretes e checklists da equipe (Equipe → Lembretes): o admin escolhe dias da semana, horário e funcionários,
-- e a função wa-automations (cron a cada 15 min) manda no WhatsApp de cada um (campo WhatsApp em Funcionários).

CREATE TABLE IF NOT EXISTS public.team_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'checklist' CHECK (kind IN ('checklist', 'lembrete')),
  message TEXT NOT NULL DEFAULT '',   -- texto de abertura; aceita {nome} e {dia}
  items TEXT[] NOT NULL DEFAULT '{}', -- itens do checklist
  weekdays INT[] NOT NULL DEFAULT '{1,2,3,4,5}', -- 0 = domingo
  send_time TIME NOT NULL DEFAULT '08:00',
  people UUID[] NOT NULL DEFAULT '{}', -- profiles.id
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_on DATE,                    -- dia (Brasília) do último envio, para não repetir
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID REFERENCES public.team_reminders(id) ON DELETE CASCADE,
  profile_id UUID,
  person TEXT NOT NULL DEFAULT '',
  sent_on DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('enviado', 'sem_contato', 'erro', 'teste')),
  error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_reminder_logs_reminder_idx ON public.team_reminder_logs (reminder_id, sent_on DESC);

ALTER TABLE public.team_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_reminder_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia lembretes da equipe" ON public.team_reminders;
CREATE POLICY "Admin gerencia lembretes da equipe" ON public.team_reminders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin vê envios dos lembretes" ON public.team_reminder_logs;
CREATE POLICY "Admin vê envios dos lembretes" ON public.team_reminder_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin registra teste dos lembretes" ON public.team_reminder_logs;
CREATE POLICY "Admin registra teste dos lembretes" ON public.team_reminder_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
