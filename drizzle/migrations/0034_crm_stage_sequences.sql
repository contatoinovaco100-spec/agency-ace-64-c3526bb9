-- Follow-up por etapa do CRM: cada sequência pode ficar ligada a uma etapa. Quando o lead entra nessa etapa
-- (criado nela ou movido para ela, pelo kanban, pelo chat ou por automação), entra sozinho na sequência.
-- Quando muda de etapa, os follow-ups da etapa anterior (e os manuais) param, e começa o da etapa nova.
ALTER TABLE public.crm_sequences ADD COLUMN IF NOT EXISTS trigger_stage text;
CREATE INDEX IF NOT EXISTS crm_sequences_trigger_stage_idx ON public.crm_sequences (trigger_stage) WHERE trigger_stage IS NOT NULL;

CREATE OR REPLACE FUNCTION public.crm_enroll_on_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage IS NULL OR (TG_OP = 'UPDATE' AND NEW.stage IS NOT DISTINCT FROM OLD.stage) THEN
    RETURN NEW;
  END IF;

  -- Mudou de etapa: para o que não é da etapa nova
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.crm_enrollments e
       SET status = 'parado', last_error = 'Lead mudou para ' || NEW.stage, updated_at = now()
     WHERE e.lead_id = NEW.id AND e.status = 'ativo'
       AND NOT EXISTS (SELECT 1 FROM public.crm_sequences s WHERE s.id = e.sequence_id AND s.trigger_stage = NEW.stage);
  END IF;

  -- Entra nas sequências ligadas à etapa nova (primeira mensagem no dia do primeiro passo)
  INSERT INTO public.crm_enrollments (lead_id, sequence_id, step_index, session_id, next_at)
  SELECT NEW.id, s.id, 0, NEW.whatsapp_session,
         now() + make_interval(days => COALESCE((s.steps -> 0 ->> 'day')::int, 0))
    FROM public.crm_sequences s
   WHERE s.active AND s.trigger_stage = NEW.stage AND jsonb_array_length(s.steps) > 0
  ON CONFLICT (lead_id, sequence_id) WHERE status = 'ativo' DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_enroll_on_stage ON public.leads;
CREATE TRIGGER crm_enroll_on_stage
  AFTER INSERT OR UPDATE OF stage ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_enroll_on_stage();

-- Etapa renomeada no CRM: a sequência acompanha o nome novo (antes de os leads serem atualizados)
CREATE OR REPLACE FUNCTION public.crm_sequences_follow_stage_rename()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.board = 'crm' AND NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.crm_sequences SET trigger_stage = NEW.name WHERE trigger_stage = OLD.name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_sequences_follow_stage_rename ON public.kanban_stages;
CREATE TRIGGER crm_sequences_follow_stage_rename
  AFTER UPDATE OF name ON public.kanban_stages
  FOR EACH ROW EXECUTE FUNCTION public.crm_sequences_follow_stage_rename();
