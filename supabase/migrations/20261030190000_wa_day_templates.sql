-- Automações do WhatsApp: texto diferente por dia da semana ({"1":"texto de segunda", "5":"texto de sexta"}).
-- Dia sem texto próprio usa o texto principal (coluna template).
ALTER TABLE public.wa_automations ADD COLUMN IF NOT EXISTS templates_by_day jsonb NOT NULL DEFAULT '{}'::jsonb;
