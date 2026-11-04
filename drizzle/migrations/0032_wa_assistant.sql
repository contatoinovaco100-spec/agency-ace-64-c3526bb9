-- Assistente da plataforma no WhatsApp (/assistente-whatsapp): responde só no grupo escolhido pelo admin,
-- consulta os dados e executa ações por texto ou áudio. wa_assistant_log guarda cada pedido, a resposta e as ações feitas.
CREATE TABLE IF NOT EXISTS public.wa_assistant_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT false,
  session_id TEXT NOT NULL DEFAULT '',
  group_id TEXT NOT NULL DEFAULT '',
  group_name TEXT NOT NULL DEFAULT '',
  allow_actions BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.wa_assistant_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.wa_assistant_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender TEXT NOT NULL DEFAULT '',
  question TEXT NOT NULL DEFAULT '',
  via_audio BOOLEAN NOT NULL DEFAULT false,
  answer TEXT NOT NULL DEFAULT '',
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.wa_assistant_settings TO authenticated;
GRANT ALL ON public.wa_assistant_settings TO service_role;
GRANT SELECT, INSERT ON public.wa_assistant_log TO authenticated;
GRANT ALL ON public.wa_assistant_log TO service_role;

ALTER TABLE public.wa_assistant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_assistant_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin configura o assistente" ON public.wa_assistant_settings;
CREATE POLICY "Admin configura o assistente" ON public.wa_assistant_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admin lê o histórico do assistente" ON public.wa_assistant_log;
CREATE POLICY "Admin lê o histórico do assistente" ON public.wa_assistant_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));