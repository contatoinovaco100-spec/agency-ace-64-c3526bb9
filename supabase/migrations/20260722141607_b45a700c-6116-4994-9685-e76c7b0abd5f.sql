CREATE OR REPLACE FUNCTION public.sync_commercial_call_from_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member_id uuid;
  v_stage_changed boolean;
  v_assignee_changed boolean;
  v_closer_changed boolean;
  v_closer_name text;
BEGIN
  v_stage_changed := (TG_OP = 'INSERT') OR (NEW.stage IS DISTINCT FROM OLD.stage);
  v_assignee_changed := (TG_OP = 'UPDATE') AND (NEW.assignee IS DISTINCT FROM OLD.assignee);
  v_closer_changed := (TG_OP = 'UPDATE') AND (NEW.closer IS DISTINCT FROM OLD.closer);

  IF NOT v_stage_changed AND NOT v_assignee_changed AND NOT v_closer_changed THEN
    RETURN NEW;
  END IF;

  -- SDR: reunião agendada
  IF NEW.stage = 'Reunião agendada' AND COALESCE(TRIM(NEW.assignee), '') <> '' THEN
    SELECT id INTO v_member_id
    FROM public.commercial_members
    WHERE active = true AND role = 'SDR' AND lower(name) = lower(NEW.assignee)
    LIMIT 1;

    IF v_member_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.commercial_calls WHERE lead_id = NEW.id AND type = 'agendada') THEN
        UPDATE public.commercial_calls
           SET member_id = v_member_id,
               client_name = COALESCE(NEW.company, NEW.name),
               deal_value = COALESCE(NEW.estimated_value, deal_value)
         WHERE lead_id = NEW.id AND type = 'agendada' AND paid_at IS NULL;
      ELSE
        INSERT INTO public.commercial_calls (member_id, type, lead_id, client_name, deal_value, source)
        VALUES (v_member_id, 'agendada', NEW.id, COALESCE(NEW.company, NEW.name),
                COALESCE(NEW.estimated_value, 0), 'crm');
      END IF;
    END IF;
  END IF;

  -- Closer: cliente fechado (prioriza NEW.closer, cai pra NEW.assignee se vazio)
  IF NEW.stage = 'Cliente fechado' THEN
    v_closer_name := COALESCE(NULLIF(TRIM(NEW.closer), ''), NULLIF(TRIM(NEW.assignee), ''));
    IF v_closer_name IS NOT NULL THEN
      SELECT id INTO v_member_id
      FROM public.commercial_members
      WHERE active = true AND role = 'Closer' AND lower(name) = lower(v_closer_name)
      LIMIT 1;

      IF v_member_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.commercial_calls WHERE lead_id = NEW.id AND type = 'fechada') THEN
          UPDATE public.commercial_calls
             SET member_id = v_member_id,
                 client_name = COALESCE(NEW.company, NEW.name),
                 deal_value = COALESCE(NEW.estimated_value, deal_value)
           WHERE lead_id = NEW.id AND type = 'fechada' AND paid_at IS NULL;
        ELSE
          INSERT INTO public.commercial_calls (member_id, type, lead_id, client_name, deal_value, source)
          VALUES (v_member_id, 'fechada', NEW.id, COALESCE(NEW.company, NEW.name),
                  COALESCE(NEW.estimated_value, 0), 'crm');
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;