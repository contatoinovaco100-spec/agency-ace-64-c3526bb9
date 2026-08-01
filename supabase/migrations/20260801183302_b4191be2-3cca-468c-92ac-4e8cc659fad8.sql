ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

UPDATE public.clients SET cancelled_at = updated_at WHERE status = 'Cancelado' AND cancelled_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_client_cancelled_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Cancelado' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'Cancelado') THEN
    NEW.cancelled_at = COALESCE(NEW.cancelled_at, now());
  ELSIF NEW.status <> 'Cancelado' THEN
    NEW.cancelled_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_client_cancelled_at ON public.clients;
CREATE TRIGGER trg_set_client_cancelled_at
BEFORE INSERT OR UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.set_client_cancelled_at();