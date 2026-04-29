-- Tabela de escopos mensais por cliente
CREATE TABLE public.client_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  notes TEXT NOT NULL DEFAULT ''::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, month)
);

CREATE INDEX idx_client_scopes_month ON public.client_scopes(month);
CREATE INDEX idx_client_scopes_client ON public.client_scopes(client_id);

ALTER TABLE public.client_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage client_scopes"
  ON public.client_scopes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_client_scopes_updated_at
  BEFORE UPDATE ON public.client_scopes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de tarefas dentro de cada escopo
CREATE TABLE public.client_scope_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id UUID NOT NULL REFERENCES public.client_scopes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Pendente',
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_scope_tasks_scope ON public.client_scope_tasks(scope_id);

ALTER TABLE public.client_scope_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage client_scope_tasks"
  ON public.client_scope_tasks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_client_scope_tasks_updated_at
  BEFORE UPDATE ON public.client_scope_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();