CREATE OR REPLACE FUNCTION public.auto_create_client_on_signature()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contract public.contracts%ROWTYPE;
  v_scope text;
  v_name text;
BEGIN
  SELECT * INTO v_contract FROM public.contracts WHERE id = NEW.contract_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_contract.status <> 'assinado' THEN
    UPDATE public.contracts SET status = 'assinado' WHERE id = v_contract.id;
  END IF;

  v_name := COALESCE(NULLIF(TRIM(v_contract.client_company), ''), NULLIF(TRIM(v_contract.client_name), ''));
  IF v_name IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.clients
    WHERE lower(trim(company_name)) = lower(v_name)
  ) THEN
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
    COALESCE(NULLIF(TRIM(NEW.signer_name), ''), NULLIF(TRIM(v_contract.client_name), ''), v_name),
    COALESCE(v_contract.client_email, ''),
    '',
    CURRENT_DATE,
    COALESCE(v_contract.monthly_value, 0),
    v_scope,
    ARRAY[]::text[],
    '',
    'Ativo',
    'Cliente criado automaticamente ao assinar contrato "' || v_contract.title || '".'
  );

  RETURN NEW;
END;
$function$;