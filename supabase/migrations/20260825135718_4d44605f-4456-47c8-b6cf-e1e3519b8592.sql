ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS pre_stage text,
  ADD COLUMN IF NOT EXISTS decupador text,
  ADD COLUMN IF NOT EXISTS decupagem_notes text,
  ADD COLUMN IF NOT EXISTS cuts_url text;

ALTER TABLE public.kanban_stages DROP CONSTRAINT IF EXISTS kanban_stages_board_check;
ALTER TABLE public.kanban_stages ADD CONSTRAINT kanban_stages_board_check
  CHECK (board = ANY (ARRAY['tasks'::text, 'crm'::text, 'artes'::text, 'pre'::text]));

INSERT INTO public.kanban_stages (board, name, position, color, is_system) VALUES
  ('pre', 'Material Bruto Recebido', 0, 'muted', false),
  ('pre', 'Em Decupagem', 1, 'warning', false),
  ('pre', 'Cortes Prontos', 2, 'info', false),
  ('pre', 'Em Edição', 3, 'accent', false),
  ('pre', 'Revisão', 4, 'destructive', false),
  ('pre', 'Finalizado', 5, 'success', true)
ON CONFLICT (board, name) DO NOTHING;

CREATE INDEX IF NOT EXISTS tasks_pre_stage_idx ON public.tasks (pre_stage);