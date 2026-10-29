-- Onboarding de clientes: um link único por cliente (token) que o próprio cliente usa para
-- responder o briefing, conectar o Instagram, dar acesso de parceiro no Meta, enviar materiais
-- e sugerir o horário do kickoff. O acesso público acontece só pela Edge Function
-- `client-onboarding` (service role), que valida o token; a equipe lê e gerencia pela RLS abaixo.

CREATE TABLE IF NOT EXISTS public.client_onboardings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido')),
  -- Data/hora em que cada etapa foi concluída: briefing, instagram, meta_partner, materials, kickoff
  steps jsonb NOT NULL DEFAULT '{}'::jsonb,
  materials_url text NOT NULL DEFAULT '',
  kickoff_preference text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  sent_at timestamptz,
  last_reminder_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_onboardings_client_id_idx ON public.client_onboardings (client_id);

ALTER TABLE public.client_onboardings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view onboardings" ON public.client_onboardings;
CREATE POLICY "Authenticated can view onboardings" ON public.client_onboardings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can create onboardings" ON public.client_onboardings;
CREATE POLICY "Authenticated can create onboardings" ON public.client_onboardings
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update onboardings" ON public.client_onboardings;
CREATE POLICY "Authenticated can update onboardings" ON public.client_onboardings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete onboardings" ON public.client_onboardings;
CREATE POLICY "Admins can delete onboardings" ON public.client_onboardings
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
