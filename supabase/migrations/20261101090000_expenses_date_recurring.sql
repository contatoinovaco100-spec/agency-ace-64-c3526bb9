-- Gastos: data de cada lançamento e gasto fixo (repete todo mês)
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS spent_on DATE,
  ADD COLUMN IF NOT EXISTS recurring BOOLEAN NOT NULL DEFAULT false;

-- Lançamentos antigos: o dia em que foram cadastrados, se caiu no próprio mês; senão o dia 1 do mês
UPDATE public.expenses
SET spent_on = CASE
  WHEN date_trunc('month', created_at)::date = month_ref THEN created_at::date
  ELSE month_ref
END
WHERE spent_on IS NULL;
