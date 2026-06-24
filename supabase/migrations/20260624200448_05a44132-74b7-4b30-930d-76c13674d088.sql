CREATE OR REPLACE FUNCTION public.sync_commercial_call_from_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_member_id uuid;
  v_role text;
  v_type text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage IS NOT DISTINCT FROM OLD.stage THEN
    RETURN NEW;
  END IF;

  IF NEW.stage = 'Reunião agendada' THEN
    v_role := 'SDR'; v_type := 'agendada';
  ELSIF NEW.stage = 'Cliente fechado' THEN
    v_role := 'Closer'; v_type := 'fechada';
  ELSE
    RETURN NEW;
  END IF;

  SELECT id INTO v_member_id
  FROM public.commercial_members
  WHERE active = true AND role = v_role AND lower(name) = lower(COALESCE(NEW.assignee,''))
  LIMIT 1;

  -- fallback: qualquer membro ativo com o papel (se houver só um)
  IF v_member_id IS NULL THEN
    SELECT id INTO v_member_id
    FROM public.commercial_members
    WHERE active = true AND role = v_role
    LIMIT 1;
  END IF;

  IF v_member_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.commercial_calls WHERE lead_id = NEW.id AND type = v_type) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.commercial_calls (member_id, type, lead_id, client_name, deal_value, source)
  VALUES (v_member_id, v_type, NEW.id, COALESCE(NEW.company, NEW.name),
          COALESCE(NEW.estimated_value, 0), 'crm');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_commercial_call_from_lead ON public.leads;
CREATE TRIGGER trg_sync_commercial_call_from_lead
AFTER INSERT OR UPDATE OF stage ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.sync_commercial_call_from_lead();

-- Backfill chamadas existentes
INSERT INTO public.commercial_calls (member_id, type, lead_id, client_name, deal_value, source)
SELECT m.id,
       CASE WHEN l.stage = 'Reunião agendada' THEN 'agendada' ELSE 'fechada' END,
       l.id, COALESCE(l.company, l.name), COALESCE(l.estimated_value, 0), 'crm'
FROM public.leads l
JOIN public.commercial_members m
  ON m.active = true
 AND ((l.stage = 'Reunião agendada' AND m.role = 'SDR')
   OR (l.stage = 'Cliente fechado' AND m.role = 'Closer'))
 AND (lower(m.name) = lower(COALESCE(l.assignee,'')) OR NOT EXISTS (
       SELECT 1 FROM public.commercial_members m2
       WHERE m2.active = true AND m2.role = m.role
         AND lower(m2.name) = lower(COALESCE(l.assignee,''))
     ))
WHERE l.stage IN ('Reunião agendada','Cliente fechado')
  AND NOT EXISTS (
    SELECT 1 FROM public.commercial_calls c
    WHERE c.lead_id = l.id
      AND c.type = CASE WHEN l.stage = 'Reunião agendada' THEN 'agendada' ELSE 'fechada' END
  );