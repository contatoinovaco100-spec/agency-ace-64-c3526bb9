-- CRM com WhatsApp: vários números, caixa de conversas, follow-up automático, distribuição e captura de leads.

-- ── Números conectados (cada um é uma sessão no servidor WhatsApp) ──
CREATE TABLE IF NOT EXISTS public.wa_numbers (
  id text PRIMARY KEY,                       -- id da sessão no servidor (ex.: default, comercial, n1x2y3)
  name text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'area' CHECK (kind IN ('area', 'vendedor')),
  area text NOT NULL DEFAULT '',             -- comercial, atendimento, financeiro…
  owner_id uuid,                             -- vendedor dono do número (profiles.id)
  capture_leads boolean NOT NULL DEFAULT false, -- contato novo que escreve vira lead
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.wa_numbers (id, name, kind, area, is_default)
VALUES ('default', 'Principal', 'area', 'geral', true) ON CONFLICT (id) DO NOTHING;

-- ── Conversas: uma por número + contato ──
ALTER TABLE public.wa_conversations ADD COLUMN IF NOT EXISTS session_id text NOT NULL DEFAULT 'default';
ALTER TABLE public.wa_conversations ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE public.wa_conversations DROP CONSTRAINT IF EXISTS wa_conversations_contact_phone_key;
CREATE UNIQUE INDEX IF NOT EXISTS wa_conversations_session_phone_idx ON public.wa_conversations (session_id, contact_phone);
CREATE UNIQUE INDEX IF NOT EXISTS wa_messages_wa_id_idx ON public.wa_messages (wa_message_id) WHERE wa_message_id IS NOT NULL;

-- ── Lead: dono, próximo passo e número preferido ──
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_step text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_step_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS whatsapp_session text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_outbound_at timestamptz;

-- ── Follow-up: sequências e leads inscritos ──
CREATE TABLE IF NOT EXISTS public.crm_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  -- [{"day":0,"message":"…"},{"day":2,"message":"…"}] (dias contados a partir da inscrição)
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  stop_on_reply boolean NOT NULL DEFAULT true,
  start_hour smallint NOT NULL DEFAULT 9,
  end_hour smallint NOT NULL DEFAULT 19,
  weekdays_only boolean NOT NULL DEFAULT true,
  -- Inscreve sozinho os leads novos que chegam pela captura
  auto_enroll_new boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES public.crm_sequences(id) ON DELETE CASCADE,
  step_index integer NOT NULL DEFAULT 0,
  next_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'respondeu', 'concluido', 'parado', 'erro')),
  session_id text,
  last_error text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_enrollments_active_idx ON public.crm_enrollments (lead_id, sequence_id) WHERE status = 'ativo';
CREATE INDEX IF NOT EXISTS crm_enrollments_due_idx ON public.crm_enrollments (next_at) WHERE status = 'ativo';

-- ── Distribuição de leads entre os vendedores (rodízio) ──
CREATE TABLE IF NOT EXISTS public.crm_sellers (
  profile_id uuid PRIMARY KEY,
  active boolean NOT NULL DEFAULT true,
  last_assigned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Acesso: toda a equipe logada (antes só admins viam as conversas) ──
ALTER TABLE public.wa_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sellers ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wa_numbers','crm_sequences','crm_enrollments','crm_sellers','wa_conversations','wa_messages'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated manage %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Authenticated manage %1$s" ON public.%1$I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- Automações podem escolher de qual número sai
ALTER TABLE public.wa_automations ADD COLUMN IF NOT EXISTS session_id text;

-- Sequência de exemplo (desligada)
INSERT INTO public.crm_sequences (name, steps, active)
SELECT 'Follow-up de proposta', jsonb_build_array(
  jsonb_build_object('day', 0, 'message', E'Oi, {nome}! Aqui é {vendedor}, da INOVA 👋\n\nPassando para saber se conseguiu ver a proposta que te enviei. Ficou alguma dúvida?'),
  jsonb_build_object('day', 2, 'message', E'{nome}, consegui separar um horário essa semana para te explicar a proposta em 15 minutos. Qual o melhor dia para você?'),
  jsonb_build_object('day', 5, 'message', E'Oi, {nome}! Só para não deixar passar: as condições que te passei valem até o fim do mês. Quer que eu reserve sua vaga?'),
  jsonb_build_object('day', 10, 'message', E'{nome}, vou encerrar seu atendimento por aqui para não te incomodar. Se quiser retomar, é só me chamar! 🙂')
), false
WHERE NOT EXISTS (SELECT 1 FROM public.crm_sequences);
