
-- Tabela de etapas customizáveis para cada kanban
CREATE TABLE public.kanban_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board text NOT NULL CHECK (board IN ('tasks','crm','artes')),
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT 'muted',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (board, name)
);

GRANT SELECT ON public.kanban_stages TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.kanban_stages TO authenticated;
GRANT ALL ON public.kanban_stages TO service_role;

ALTER TABLE public.kanban_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view stages"
  ON public.kanban_stages FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert stages"
  ON public.kanban_stages FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins can update stages"
  ON public.kanban_stages FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins can delete stages"
  ON public.kanban_stages FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(),'admin') AND is_system = false);

CREATE TRIGGER kanban_stages_set_updated_at
  BEFORE UPDATE ON public.kanban_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sementes iniciais
INSERT INTO public.kanban_stages (board, name, position, color, is_system) VALUES
  ('tasks','Ideias / Backlog', 0, 'muted',       false),
  ('tasks','Em Copy',          1, 'primary',     false),
  ('tasks','Em Direção',       2, 'info',        false),
  ('tasks','Em Gravação',      3, 'warning',     false),
  ('tasks','Em Edição',        4, 'accent',      false),
  ('tasks','Revisão',          5, 'destructive', false),
  ('tasks','Finalizado',       6, 'success',     true),
  ('tasks','Concluído',        7, 'muted',       true),
  ('artes','Ideias / Backlog', 0, 'muted',       false),
  ('artes','Em Copy',          1, 'primary',     false),
  ('artes','Em Direção',       2, 'info',        false),
  ('artes','Em Edição',        3, 'accent',      false),
  ('artes','Revisão',          4, 'destructive', false),
  ('artes','Finalizado',       5, 'success',     true),
  ('artes','Concluído',        6, 'muted',       true),
  ('crm','Lead novo',          0, 'info',        false),
  ('crm','Contato iniciado',   1, 'primary',     false),
  ('crm','Reunião agendada',   2, 'warning',     false),
  ('crm','Proposta enviada',   3, 'success',     false),
  ('crm','Negociação',         4, 'primary',     false),
  ('crm','Cliente fechado',    5, 'success',     true),
  ('crm','Perdido',            6, 'destructive', true);

-- Função para renomear uma etapa e atualizar os registros que a usavam
CREATE OR REPLACE FUNCTION public.rename_kanban_stage(_board text, _old_name text, _new_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.kanban_stages
     SET name = _new_name
   WHERE board = _board AND name = _old_name;

  IF _board IN ('tasks','artes') THEN
    UPDATE public.tasks SET status = _new_name WHERE status = _old_name;
  ELSIF _board = 'crm' THEN
    UPDATE public.leads SET stage = _new_name WHERE stage = _old_name;
  END IF;
END;
$$;
