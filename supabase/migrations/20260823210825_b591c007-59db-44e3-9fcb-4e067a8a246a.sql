CREATE TABLE public.task_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  score smallint NOT NULL CHECK (score >= 0 AND score <= 10),
  comment text NOT NULL DEFAULT '',
  evaluated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, member_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_evaluations TO authenticated;
GRANT ALL ON public.task_evaluations TO service_role;

ALTER TABLE public.task_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read task evaluations"
  ON public.task_evaluations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage task evaluations"
  ON public.task_evaluations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_task_evaluations_member ON public.task_evaluations (lower(member_name));

CREATE TRIGGER update_task_evaluations_updated_at
  BEFORE UPDATE ON public.task_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();