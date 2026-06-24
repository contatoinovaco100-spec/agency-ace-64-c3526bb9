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

  IF COALESCE(TRIM(NEW.assignee), '') = '' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_member_id
  FROM public.commercial_members
  WHERE active = true AND role = v_role AND lower(name) = lower(NEW.assignee)
  LIMIT 1;

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

-- Limpa calls de origem CRM onde o responsável do lead não bate com o membro
DELETE FROM public.commercial_calls c
USING public.leads l, public.commercial_members m
WHERE c.source = 'crm'
  AND c.lead_id = l.id
  AND c.member_id = m.id
  AND lower(COALESCE(l.assignee,'')) <> lower(m.name);