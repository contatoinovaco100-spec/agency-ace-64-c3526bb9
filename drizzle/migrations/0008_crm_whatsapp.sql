-- CRM com WhatsApp: vários números, caixa de conversas, follow-up automático, distribuição e captura de leads.
CREATE TABLE IF NOT EXISTS public.wa_numbers (
 id text PRIMARY KEY,
 name text NOT NULL DEFAULT '',
 kind text NOT NULL DEFAULT 'area' CHECK (kind IN ('area', 'vendedor')),
 area text NOT NULL DEFAULT '',
 owner_id uuid,
 capture_leads boolean NOT NULL DEFAULT false,
 is_default boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_numbers TO authenticated;
GRANT ALL ON public.wa_numbers TO service_role;
ALTER TABLE public.wa_conversations ADD COLUMN IF NOT EXISTS session_id text NOT NULL DEFAULT 'default';
ALTER TABLE public.wa_conversations ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE public.wa_conversations DROP CONSTRAINT IF EXISTS wa_conversations_contact_phone_key;
CREATE UNIQUE INDEX IF NOT EXISTS wa_conversations_session_phone_idx ON public.wa_conversations (session_id, contact_phone);
CREATE UNIQUE INDEX IF NOT EXISTS wa_messages_wa_id_idx ON public.wa_messages (wa_message_id) WHERE wa_message_id IS NOT NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_step text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_step_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS whatsapp_session text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_outbound_at timestamptz;
CREATE TABLE IF NOT EXISTS public.crm_sequences (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL,
 steps jsonb NOT NULL DEFAULT '[]'::jsonb,
 stop_on_reply boolean NOT NULL DEFAULT true,
 start_hour smallint NOT NULL DEFAULT 9,
 end_hour smallint NOT NULL DEFAULT 19,
 weekdays_only boolean NOT NULL DEFAULT true,
 auto_enroll_new boolean NOT NULL DEFAULT false,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_sequences TO authenticated;
GRANT ALL ON public.crm_sequences TO service_role;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_enrollments TO authenticated;
GRANT ALL ON public.crm_enrollments TO service_role;
CREATE UNIQUE INDEX IF NOT EXISTS crm_enrollments_active_idx ON public.crm_enrollments (lead_id, sequence_id) WHERE status = 'ativo';
CREATE INDEX IF NOT EXISTS crm_enrollments_due_idx ON public.crm_enrollments (next_at) WHERE status = 'ativo';
CREATE TABLE IF NOT EXISTS public.crm_sellers (
 profile_id uuid PRIMARY KEY,
 active boolean NOT NULL DEFAULT true,
 last_assigned_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_sellers TO authenticated;
GRANT ALL ON public.crm_sellers TO service_role;
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
ALTER TABLE public.wa_automations ADD COLUMN IF NOT EXISTS session_id text;