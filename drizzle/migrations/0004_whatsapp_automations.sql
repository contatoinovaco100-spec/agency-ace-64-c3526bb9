-- lovable-cron-fallback-reviewed: automações de WhatsApp disparam em horários fixos de Brasília (9h, 10h, 16h); a checagem a cada 15 min é o mecanismo de agendamento e não pode ser substituída por trigger/webhook.
-- Automações do WhatsApp (página /automacoes): cada automação tem gatilho, horário, destino e texto editáveis.
-- A função wa-automations roda a cada 15 minutos, dispara o que estiver no horário e registra cada mensagem.
-- Mensagens saem pelo servidor WhatsApp da INOVA (QR Code), configurado nos segredos WA_SERVER_URL e WA_API_KEY.

-- Substitui as automações fixas anteriores (approval-reminders e monthly-reports): desliga os agendamentos
-- antigos para não mandar mensagem em dobro. O histórico antigo fica em approval_reminders.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'approval-reminders') THEN
    PERFORM cron.unschedule('approval-reminders');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-reports') THEN
    PERFORM cron.unschedule('monthly-reports');
  END IF;
END $$;

-- Grupo do WhatsApp de cada cliente: as mensagens vão para ele quando existir
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS whatsapp_group_id text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS whatsapp_group_name text;

CREATE TABLE IF NOT EXISTS public.wa_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  -- approval_pending, monthly_report, invoice_due_soon, invoice_due_today, invoice_overdue,
  -- shooting_tomorrow, post_today, team_daily_summary, manual
  trigger text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  template text NOT NULL DEFAULT '',
  -- Dias da semana (0 = domingo) e horário de Brasília em que roda
  days_of_week smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',
  send_time time NOT NULL DEFAULT '10:00',
  -- Parâmetros do gatilho: wait_days, gap_days, max_per_item, days_before, days_after, day_of_month
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Público: {"type":"all"} | {"type":"clients","client_ids":[...]} | {"type":"team","to":"<grupo ou telefone>"}
  audience jsonb NOT NULL DEFAULT '{"type":"all"}'::jsonb,
  -- group_then_phone | group | phone
  destination text NOT NULL DEFAULT 'group_then_phone',
  -- Disparo manual: quando enviar e quando foi enviado
  scheduled_at timestamptz,
  sent_at timestamptz,
  last_run_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES public.wa_automations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  -- Chave para não repetir o mesmo envio (ex.: task:<id>, invoice:<id>:soon, report:2026-10)
  ref text NOT NULL DEFAULT '',
  recipient text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('enviado', 'sem_contato', 'erro', 'teste')),
  error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_automation_logs_created_idx ON public.wa_automation_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS wa_automation_logs_ref_idx ON public.wa_automation_logs (automation_id, ref);

ALTER TABLE public.wa_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_automation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated manage wa automations" ON public.wa_automations;
CREATE POLICY "Authenticated manage wa automations" ON public.wa_automations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated view wa automation logs" ON public.wa_automation_logs;
CREATE POLICY "Authenticated view wa automation logs" ON public.wa_automation_logs
  FOR SELECT TO authenticated USING (true);

-- Automações prontas (desligadas: a equipe revisa o texto e liga na página)
INSERT INTO public.wa_automations (name, description, trigger, template, days_of_week, send_time, params)
SELECT * FROM (VALUES
  ('Lembrete de aprovação', 'Cliente com conteúdo esperando aprovação há alguns dias', 'approval_pending',
   E'Oi, {nome}! 👋 Aqui é da INOVA.\n\n{qtd_texto} esperando a sua aprovação:\n{lista_conteudos}\n\n👉 {link_aprovacao}\n\nÉ só abrir, assistir e tocar em *Aprovar* ou *Pedir ajuste*. Assim a gente já agenda a publicação. 😉',
   '{1,2,3,4,5}'::smallint[], '10:00'::time, '{"wait_days":2,"gap_days":3,"max_per_item":3}'::jsonb),
  ('Relatório mensal', 'Link do relatório do mês anterior', 'monthly_report',
   E'Oi, {nome}! 📊 Aqui é da INOVA.\n\nSeu relatório de *{mes}* está pronto: foram *{qtd} conteúdos* no ar.\n\nVeja o que foi publicado e o que vem por aí:\n👉 {link_relatorio}',
   '{0,1,2,3,4,5,6}'::smallint[], '10:00'::time, '{"day_of_month":1}'::jsonb),
  ('Fatura vence em breve', 'Aviso alguns dias antes do vencimento', 'invoice_due_soon',
   E'Oi, {nome}! Tudo bem? 😊\n\nPassando para lembrar que a fatura *{descricao}* de *{valor}* vence em *{vencimento}*.\n\nPara pagar pelo Pix ou ver os detalhes:\n👉 {link_fatura}',
   '{1,2,3,4,5}'::smallint[], '09:00'::time, '{"days_before":3}'::jsonb),
  ('Fatura vence hoje', 'Aviso no dia do vencimento', 'invoice_due_today',
   E'Oi, {nome}! A fatura *{descricao}* de *{valor}* vence *hoje*.\n\n👉 {link_fatura}\n\nSe já pagou, pode desconsiderar. Obrigado! 🙏',
   '{0,1,2,3,4,5,6}'::smallint[], '09:00'::time, '{}'::jsonb),
  ('Fatura vencida', 'Cobrança alguns dias depois do vencimento', 'invoice_overdue',
   E'Oi, {nome}! Notamos que a fatura *{descricao}* de *{valor}*, com vencimento em {vencimento}, ainda está em aberto.\n\n👉 {link_fatura}\n\nSe já pagou, é só nos enviar o comprovante por aqui. 🙏',
   '{1,2,3,4,5}'::smallint[], '10:00'::time, '{"days_after":3}'::jsonb),
  ('Lembrete de gravação', 'No dia anterior à gravação', 'shooting_tomorrow',
   E'Oi, {nome}! 🎬 Amanhã tem gravação com a INOVA:\n\n*{titulo}*\n📅 {data} às {hora}\n📍 {local}\n\nQualquer imprevisto, é só avisar por aqui!',
   '{0,1,2,3,4,5,6}'::smallint[], '16:00'::time, '{}'::jsonb),
  ('Post vai ao ar hoje', 'Aviso dos posts do dia', 'post_today',
   E'Bom dia, {nome}! ☀️ Hoje vai ao ar no seu perfil:\n{lista_conteudos}\n\nFica de olho e interage nos comentários! 💚',
   '{0,1,2,3,4,5,6}'::smallint[], '09:00'::time, '{}'::jsonb),
  ('Resumo diário da equipe', 'Pendências do dia no grupo da equipe', 'team_daily_summary',
   E'☀️ *Resumo do dia — INOVA*\n\n✅ Aprovados para agendar: {aprovados}\n⏰ Posts atrasados (30 dias): {atrasados}\n✏️ Posts dos próximos 3 dias sem legenda: {sem_legenda}\n⌛ Esperando aprovação do cliente há 2+ dias: {aguardando}\n\nAbrir o Meu dia: {link_meu_dia}',
   '{1,2,3,4,5}'::smallint[], '08:00'::time, '{}'::jsonb)
) AS seed(name, description, trigger, template, days_of_week, send_time, params)
WHERE NOT EXISTS (SELECT 1 FROM public.wa_automations a WHERE a.trigger = seed.trigger);

-- Portal do cliente (/portal/:clientId): faturas do cliente (o vínculo das faturas é pelo nome da empresa)
CREATE OR REPLACE FUNCTION public.get_public_client_invoices(_client_id uuid)
RETURNS TABLE (id uuid, description text, amount numeric, due_date date, status text, paid_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT i.id, i.description, i.amount, i.due_date, i.status, i.paid_at
  FROM public.invoices i
  JOIN public.clients c ON lower(trim(c.company_name)) = lower(trim(i.client_name))
  WHERE c.id = _client_id AND c.deleted_at IS NULL
  ORDER BY i.due_date DESC NULLS LAST
  LIMIT 12;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_client_invoices(uuid) TO anon, authenticated;

-- Motor das automações: a cada 15 minutos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wa-automations') THEN
    PERFORM cron.unschedule('wa-automations');
  END IF;
END $$;

SELECT cron.schedule(
  'wa-automations',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cdzzewovtxotkghzeafr.supabase.co/functions/v1/wa-automations',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{"action":"run"}'
  );
  $$
);