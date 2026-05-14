ALTER TABLE public.portfolio_projects ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 AS rn
  FROM public.portfolio_projects
)
UPDATE public.portfolio_projects p SET order_index = r.rn FROM ranked r WHERE p.id = r.id;
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_order ON public.portfolio_projects(order_index);