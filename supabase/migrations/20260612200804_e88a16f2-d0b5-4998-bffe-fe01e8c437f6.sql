
-- Trigger function: auto-create client on signature
CREATE OR REPLACE FUNCTION public.auto_create_client_on_signature()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract public.contracts%ROWTYPE;
  v_scope text;
BEGIN
  SELECT * INTO v_contract FROM public.contracts WHERE id = NEW.contract_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- mark contract signed
  IF v_contract.status <> 'assinado' THEN
    UPDATE public.contracts SET status = 'assinado' WHERE id = v_contract.id;
  END IF;

  IF COALESCE(TRIM(v_contract.client_name), '') = '' THEN RETURN NEW; END IF;

  IF EXISTS (SELECT 1 FROM public.clients WHERE company_name ILIKE v_contract.client_name) THEN
    RETURN NEW;
  END IF;

  v_scope := COALESCE(NULLIF(TRIM(v_contract.scope_description), ''),
                      NULLIF(TRIM(v_contract.services), ''),
                      CASE WHEN v_contract.plan_name IS NOT NULL THEN 'Plano ' || v_contract.plan_name ELSE '' END);

  INSERT INTO public.clients (
    company_name, contact_name, email, phone, contract_start_date,
    monthly_value, scope, service_type, account_manager, status, notes
  ) VALUES (
    v_contract.client_name,
    COALESCE(NEW.signer_name, v_contract.client_name),
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
$$;

DROP TRIGGER IF EXISTS trg_auto_create_client_on_signature ON public.contract_signatures;
CREATE TRIGGER trg_auto_create_client_on_signature
AFTER INSERT ON public.contract_signatures
FOR EACH ROW EXECUTE FUNCTION public.auto_create_client_on_signature();

-- Backfill the two missing clients
INSERT INTO public.clients (company_name, contact_name, email, phone, contract_start_date, monthly_value, scope, service_type, account_manager, status, notes)
SELECT c.client_name,
       COALESCE((SELECT signer_name FROM public.contract_signatures WHERE contract_id = c.id ORDER BY signed_at DESC LIMIT 1), c.client_name),
       COALESCE(c.client_email, ''), '', CURRENT_DATE,
       COALESCE(c.monthly_value, 0),
       COALESCE(NULLIF(TRIM(c.scope_description), ''), NULLIF(TRIM(c.services), ''),
                CASE WHEN c.plan_name IS NOT NULL THEN 'Plano ' || c.plan_name ELSE '' END),
       ARRAY[]::text[], '', 'Ativo',
       'Cliente criado automaticamente ao assinar contrato "' || c.title || '" (backfill).'
FROM public.contracts c
WHERE c.id IN ('82a2036a-8ae9-4304-8bd5-d027718f4dc8','db9fbdc7-a235-4128-aae1-96af0615e521')
  AND NOT EXISTS (SELECT 1 FROM public.clients cl WHERE cl.company_name ILIKE c.client_name);
