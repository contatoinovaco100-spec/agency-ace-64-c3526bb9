ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS spent_on DATE,
  ADD COLUMN IF NOT EXISTS recurring BOOLEAN NOT NULL DEFAULT false;

UPDATE public.expenses
SET spent_on = CASE
  WHEN date_trunc('month', created_at)::date = month_ref THEN created_at::date
  ELSE month_ref
END
WHERE spent_on IS NULL;