-- Add recurrence support
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_day integer,
  ADD COLUMN IF NOT EXISTS month_ref date NOT NULL DEFAULT date_trunc('month', now())::date,
  ADD COLUMN IF NOT EXISTS parent_invoice_id uuid;

CREATE INDEX IF NOT EXISTS idx_invoices_recurring ON public.invoices(is_recurring, month_ref);

-- Function to roll recurring invoices into the current month
CREATE OR REPLACE FUNCTION public.renew_recurring_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', now())::date;
  v_count integer := 0;
  r record;
  v_due date;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (COALESCE(parent_invoice_id, id))
      *
    FROM public.invoices
    WHERE is_recurring = true
    ORDER BY COALESCE(parent_invoice_id, id), month_ref DESC
  LOOP
    -- skip if a child for this month already exists
    IF EXISTS (
      SELECT 1 FROM public.invoices
      WHERE month_ref = v_month
        AND (parent_invoice_id = COALESCE(r.parent_invoice_id, r.id)
             OR id = COALESCE(r.parent_invoice_id, r.id) AND month_ref = v_month)
    ) THEN
      CONTINUE;
    END IF;

    v_due := (v_month + ((COALESCE(r.recurrence_day, 10) - 1) || ' days')::interval)::date;

    INSERT INTO public.invoices (
      client_name, client_contact, description, amount, due_date,
      custom_message, notes, pix_code, status, is_recurring,
      recurrence_day, month_ref, parent_invoice_id
    ) VALUES (
      r.client_name, r.client_contact, r.description, r.amount, v_due,
      r.custom_message, r.notes, r.pix_code, 'pendente', true,
      COALESCE(r.recurrence_day, 10), v_month, COALESCE(r.parent_invoice_id, r.id)
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Schedule via pg_cron (1st of every month at 06:00 UTC)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('renew-recurring-invoices');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'renew-recurring-invoices',
  '0 6 1 * *',
  $$ SELECT public.renew_recurring_invoices(); $$
);