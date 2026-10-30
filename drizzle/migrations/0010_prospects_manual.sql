-- Prospecção manual também fica salva no banco (antes era só no navegador).
-- Empresas da prospecção manual ficam em prospects sem campanha (campaign_id nulo), com os status
-- novo / contatado / interessado / fechado. O telefone continua único: a mesma empresa não entra duas vezes.
ALTER TABLE public.prospects ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS instagram text NOT NULL DEFAULT '';
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS prospects_manual_idx ON public.prospects (created_at) WHERE campaign_id IS NULL;
