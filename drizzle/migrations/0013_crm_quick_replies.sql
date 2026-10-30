-- Respostas rápidas do CRM: na conversa, digitar "/" + atalho insere o texto salvo.
CREATE TABLE IF NOT EXISTS public.crm_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut text NOT NULL,          -- sem a barra: "bomdia" → /bomdia
  message text NOT NULL,
  uses int NOT NULL DEFAULT 0,     -- as mais usadas aparecem primeiro
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_quick_replies_shortcut_key ON public.crm_quick_replies (lower(shortcut));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_quick_replies TO authenticated;
GRANT ALL ON public.crm_quick_replies TO service_role;

ALTER TABLE public.crm_quick_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated manage crm_quick_replies" ON public.crm_quick_replies;
CREATE POLICY "Authenticated manage crm_quick_replies" ON public.crm_quick_replies
  FOR ALL TO authenticated USING (true) WITH CHECK (true);