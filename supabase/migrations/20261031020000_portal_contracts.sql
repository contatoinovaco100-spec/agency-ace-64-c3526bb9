-- Portal do cliente: contratos do cliente (só o necessário para listar e abrir o link /contrato/:id)
CREATE OR REPLACE FUNCTION public.get_public_client_contracts(_client_id uuid)
RETURNS TABLE (id uuid, title text, plan_name text, status text, created_at timestamptz, duration_months int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT ct.id, ct.title, ct.plan_name, ct.status, ct.created_at, ct.duration_months
  FROM public.contracts ct
  JOIN public.clients c ON c.id = _client_id AND c.deleted_at IS NULL
  WHERE ct.status IN ('enviado', 'assinado')
    AND (ct.client_id = c.id
         OR (ct.client_id IS NULL AND lower(trim(ct.client_company)) = lower(trim(c.company_name))))
  ORDER BY ct.created_at DESC
  LIMIT 5;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_client_contracts(uuid) TO anon, authenticated;
