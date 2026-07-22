CREATE OR REPLACE FUNCTION public.sync_commercial_call_from_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member_id uuid;
  v_role text;
  v_type text;
  v_stage_changed boolean;
  v_assignee_changed boolean;
BEGIN
  v_stage_changed := (TG_OP = 'INSERT') OR (NEW.stage IS DISTINCT FROM OLD.stage);
  v_assignee_changed := (TG_OP = 'UPDATE') AND (NEW.assignee IS DISTINCT FROM OLD.assignee);

  IF NOT v_stage_changed AND NOT v_assignee_changed THEN
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

  -- If a call already exists for this lead+type, reassign it to the correct member
  IF EXISTS (SELECT 1 FROM public.commercial_calls WHERE lead_id = NEW.id AND type = v_type) THEN
    UPDATE public.commercial_calls
       SET member_id = v_member_id,
           client_name = COALESCE(NEW.company, NEW.name),
           deal_value = COALESCE(NEW.estimated_value, deal_value)
     WHERE lead_id = NEW.id AND type = v_type AND paid_at IS NULL;
    RETURN NEW;
  END IF;

  INSERT INTO public.commercial_calls (member_id, type, lead_id, client_name, deal_value, source)
  VALUES (v_member_id, v_type, NEW.id, COALESCE(NEW.company, NEW.name),
          COALESCE(NEW.estimated_value, 0), 'crm');

  RETURN NEW;
END;
$function$;