-- LTV certo: o contrato para de render quando o cliente é pausado ou cancelado.
-- billing_stopped_at: desde quando está parado (pausa ou cancelamento; vale a data mais antiga)
-- stopped_periods: pausas que já terminaram ([{from, to}]), para não contar esses meses depois que volta
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS billing_stopped_at timestamptz;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS stopped_periods jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Clientes já parados: cancelado usa a data do cancelamento; pausado usa a última alteração do cadastro
-- (melhor estimativa disponível; dá para corrigir no cadastro do cliente)
UPDATE public.clients SET billing_stopped_at = cancelled_at
  WHERE status = 'Cancelado' AND billing_stopped_at IS NULL AND cancelled_at IS NOT NULL;
UPDATE public.clients SET billing_stopped_at = updated_at
  WHERE status = 'Pausado' AND billing_stopped_at IS NULL;

-- Roda depois de trg_set_client_cancelled_at (ordem alfabética), então NEW.cancelled_at já está preenchido
CREATE OR REPLACE FUNCTION public.track_client_billing_stop()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  was_stopped boolean := TG_OP = 'UPDATE' AND OLD.status IN ('Pausado', 'Cancelado');
BEGIN
  IF NEW.status IN ('Pausado', 'Cancelado') THEN
    IF was_stopped THEN
      -- Continua parado (ex.: pausado e depois cancelado): mantém a data em que parou, ou a corrigida no cadastro
      NEW.billing_stopped_at := COALESCE(NEW.billing_stopped_at, OLD.billing_stopped_at, OLD.cancelled_at, now());
    ELSE
      NEW.billing_stopped_at := COALESCE(CASE WHEN TG_OP = 'INSERT' THEN NEW.billing_stopped_at END, NEW.cancelled_at, now());
    END IF;
  ELSE
    IF was_stopped THEN
      -- Voltou a ficar ativo: guarda o período parado e zera
      NEW.stopped_periods := COALESCE(OLD.stopped_periods, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'from', COALESCE(OLD.billing_stopped_at, OLD.cancelled_at, now()), 'to', now()));
    END IF;
    NEW.billing_stopped_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_client_billing_stop ON public.clients;
CREATE TRIGGER trg_track_client_billing_stop
BEFORE INSERT OR UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.track_client_billing_stop();
