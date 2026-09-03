CREATE OR REPLACE FUNCTION public.auto_create_client_on_signature()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract public.contracts%ROWTYPE;
  v_name text;
  v_key text;
  v_scope text;
  v_existing uuid;
BEGIN
  SELECT * INTO v_contract FROM public.contracts WHERE id = NEW.contract_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_contract.status <> 'assinado' THEN
    UPDATE public.contracts SET status = 'assinado' WHERE id = v_contract.id;
  END IF;

  v_name := COALESCE(NULLIF(TRIM(v_contract.client_company), ''), NULLIF(TRIM(v_contract.client_name), ''));
  IF v_name IS NULL THEN RETURN NEW; END IF;

  v_key := lower(regexp_replace(v_name, '\s+', ' ', 'g'));

  PERFORM pg_advisory_xact_lock(hashtext('auto_client:' || v_key));

  SELECT id INTO v_existing
  FROM public.clients
  WHERE lower(regexp_replace(COALESCE(company_name, ''), '\s+', ' ', 'g')) = v_key
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.contracts SET client_id = COALESCE(client_id, v_existing) WHERE id = v_contract.id;
    RETURN NEW;
  END IF;

  v_scope := COALESCE(NULLIF(TRIM(v_contract.scope_description), ''),
                      NULLIF(TRIM(v_contract.services), ''),
                      CASE WHEN v_contract.plan_name IS NOT NULL THEN 'Plano ' || v_contract.plan_name ELSE '' END);

  INSERT INTO public.clients (
    company_name, contact_name, email, phone, contract_start_date,
    monthly_value, scope, service_type, account_manager, status, notes
  ) VALUES (
    v_name,
    COALESCE(NULLIF(TRIM(v_contract.client_name), ''), NEW.signer_name, v_name),
    COALESCE(v_contract.client_email, ''),
    '',
    CURRENT_DATE,
    COALESCE(v_contract.monthly_value, 0),
    COALESCE(v_scope, ''),
    ARRAY[]::text[], '', 'Ativo',
    'Cliente criado automaticamente ao assinar o contrato "' || COALESCE(v_contract.title, '') || '".'
  )
  RETURNING id INTO v_existing;

  UPDATE public.contracts SET client_id = COALESCE(client_id, v_existing) WHERE id = v_contract.id;

  RETURN NEW;
END;
$$;