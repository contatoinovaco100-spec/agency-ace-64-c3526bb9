DELETE FROM public.clients AS duplicate
WHERE duplicate.created_at >= TIMESTAMPTZ '2026-08-10 02:05:00+00'
  AND duplicate.created_at < TIMESTAMPTZ '2026-08-10 02:06:00+00'
  AND NOT EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.client_id = duplicate.id
  )
  AND EXISTS (
    SELECT 1
    FROM public.clients AS original
    WHERE original.id <> duplicate.id
      AND original.created_at < duplicate.created_at
      AND (
        (NULLIF(lower(trim(duplicate.email)), '') IS NOT NULL
          AND lower(trim(original.email)) = lower(trim(duplicate.email)))
        OR
        (NULLIF(lower(trim(duplicate.contact_name)), '') IS NOT NULL
          AND lower(trim(original.contact_name)) = lower(trim(duplicate.contact_name)))
      )
  );

CREATE OR REPLACE FUNCTION public.auto_create_client_on_signature()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.contracts
     SET status = 'assinado'
   WHERE id = NEW.contract_id
     AND status <> 'assinado';
  RETURN NEW;
END;
$function$;