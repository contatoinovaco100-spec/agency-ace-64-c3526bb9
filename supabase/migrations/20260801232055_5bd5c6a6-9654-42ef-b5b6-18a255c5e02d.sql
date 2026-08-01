ALTER TABLE public.publish_jobs ADD COLUMN IF NOT EXISTS media_paths text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.instagram_metrics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  followers integer NOT NULL DEFAULT 0,
  media_count integer NOT NULL DEFAULT 0,
  reach integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  profile_views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, snapshot_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instagram_metrics_snapshots TO authenticated;
GRANT ALL ON public.instagram_metrics_snapshots TO service_role;

ALTER TABLE public.instagram_metrics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ig snapshots"
  ON public.instagram_metrics_snapshots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage ig snapshots"
  ON public.instagram_metrics_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_ig_snapshots_updated_at
  BEFORE UPDATE ON public.instagram_metrics_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();