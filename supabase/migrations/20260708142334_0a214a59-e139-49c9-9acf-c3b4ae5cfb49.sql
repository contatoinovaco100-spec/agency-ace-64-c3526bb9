
CREATE OR REPLACE FUNCTION public.auto_create_instagram_arte_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract public.contracts%ROWTYPE;
  v_client_id uuid;
  v_title text;
  v_titles text[] := ARRAY['Destaques','Fixado 1','Fixado 2','Fixado 3'];
  v_desc text;
BEGIN
  IF NEW.accepted IS NOT TRUE THEN RETURN NEW; END IF;

  SELECT * INTO v_contract FROM public.contracts WHERE id = NEW.contract_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- resolve client: prefer contract.client_id, otherwise find by company_name
  v_client_id := v_contract.client_id;
  IF v_client_id IS NULL AND COALESCE(TRIM(v_contract.client_name), '') <> '' THEN
    SELECT id INTO v_client_id FROM public.clients
      WHERE company_name ILIKE v_contract.client_name LIMIT 1;
  END IF;

  IF v_client_id IS NULL THEN RETURN NEW; END IF;

  -- dedup: if any of the 4 tasks already exist for this client, skip all
  IF EXISTS (
    SELECT 1 FROM public.tasks
    WHERE client_id = v_client_id
      AND task_type = 'Arte'
      AND title = ANY(v_titles)
  ) THEN
    RETURN NEW;
  END IF;

  FOREACH v_title IN ARRAY v_titles LOOP
    v_desc := CASE
      WHEN v_title = 'Destaques' THEN 'Criar capas dos Destaques do Instagram do cliente.'
      ELSE 'Criar arte do post fixado do Instagram do cliente (' || v_title || ').'
    END;
    INSERT INTO public.tasks (
      client_id, title, description, priority, status, task_type, platform, observations
    ) VALUES (
      v_client_id, v_title, v_desc, 'Média', 'A fazer', 'Arte', 'Instagram',
      'Card criado automaticamente ao assinar contrato.'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_create_instagram_arte_tasks() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_auto_create_instagram_arte_tasks ON public.contract_signatures;
CREATE TRIGGER trg_auto_create_instagram_arte_tasks
AFTER INSERT ON public.contract_signatures
FOR EACH ROW EXECUTE FUNCTION public.auto_create_instagram_arte_tasks();
