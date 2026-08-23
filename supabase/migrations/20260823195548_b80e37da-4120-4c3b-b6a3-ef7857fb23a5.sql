CREATE TABLE public.client_daily_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  score_date date NOT NULL,
  score smallint NOT NULL CHECK (score >= 0 AND score <= 10),
  note text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (client_id, score_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_daily_scores TO authenticated;
GRANT ALL ON public.client_daily_scores TO service_role;

ALTER TABLE public.client_daily_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage client daily scores"
  ON public.client_daily_scores FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_client_daily_scores_date ON public.client_daily_scores (score_date DESC);

CREATE TRIGGER update_client_daily_scores_updated_at
  BEFORE UPDATE ON public.client_daily_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();