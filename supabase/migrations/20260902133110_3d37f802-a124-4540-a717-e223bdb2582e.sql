CREATE TABLE public.client_weekly_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  week_start date NOT NULL DEFAULT date_trunc('week', now())::date,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  highlight text NOT NULL DEFAULT 'normal',
  author_user_id uuid,
  author_name text NOT NULL DEFAULT '',
  is_account_manager boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_weekly_notes TO authenticated;
GRANT ALL ON public.client_weekly_notes TO service_role;

ALTER TABLE public.client_weekly_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view weekly notes"
  ON public.client_weekly_notes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create weekly notes"
  ON public.client_weekly_notes FOR INSERT TO authenticated
  WITH CHECK (author_user_id = auth.uid());

CREATE POLICY "Author or admin can update weekly notes"
  ON public.client_weekly_notes FOR UPDATE TO authenticated
  USING (author_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (author_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Author or admin can delete weekly notes"
  ON public.client_weekly_notes FOR DELETE TO authenticated
  USING (author_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_client_weekly_notes_client_week ON public.client_weekly_notes (client_id, week_start DESC);

CREATE TRIGGER update_client_weekly_notes_updated_at
  BEFORE UPDATE ON public.client_weekly_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();