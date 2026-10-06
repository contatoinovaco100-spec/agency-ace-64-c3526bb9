CREATE OR REPLACE FUNCTION public.get_public_client_tasks(_anchor uuid)
 RETURNS SETOF tasks
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id uuid;
BEGIN
  SELECT client_id INTO v_client_id FROM public.tasks WHERE id = _anchor LIMIT 1;

  IF v_client_id IS NOT NULL THEN
    RETURN QUERY
      SELECT * FROM public.tasks
      WHERE client_id = v_client_id AND deleted_at IS NULL
      ORDER BY due_date NULLS LAST;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.clients WHERE id = _anchor) THEN
    RETURN QUERY
      SELECT * FROM public.tasks
      WHERE client_id = _anchor AND deleted_at IS NULL
      ORDER BY due_date NULLS LAST;
    RETURN;
  END IF;

  RETURN QUERY SELECT * FROM public.tasks WHERE id = _anchor AND deleted_at IS NULL;
END;
$function$;