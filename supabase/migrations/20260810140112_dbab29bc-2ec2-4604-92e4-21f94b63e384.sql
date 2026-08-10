DROP TRIGGER IF EXISTS trg_auto_create_client_on_signature ON public.contract_signatures;

CREATE OR REPLACE FUNCTION public.auto_create_client_on_signature()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Criação automática de cliente desativada para evitar duplicidade.
  -- Apenas marca o contrato como assinado.
  UPDATE public.contracts
     SET status = 'assinado'
   WHERE id = NEW.contract_id AND status <> 'assinado';
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_mark_contract_signed
AFTER INSERT ON public.contract_signatures
FOR EACH ROW EXECUTE FUNCTION public.auto_create_client_on_signature();