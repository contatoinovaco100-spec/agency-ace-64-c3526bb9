
CREATE TABLE public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  platform text NOT NULL,
  external_id text,
  username text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  profile_picture text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'connected',
  expires_at timestamptz,
  last_synced_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage social_accounts" ON public.social_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.social_account_secrets (
  account_id uuid PRIMARY KEY REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  access_token text NOT NULL DEFAULT '',
  refresh_token text NOT NULL DEFAULT '',
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.social_account_secrets TO service_role;
ALTER TABLE public.social_account_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.publish_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  media_path text NOT NULL DEFAULT '',
  media_url text NOT NULL DEFAULT '',
  media_type text NOT NULL DEFAULT 'video',
  thumbnail_url text NOT NULL DEFAULT '',
  caption text NOT NULL DEFAULT '',
  first_comment text NOT NULL DEFAULT '',
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publish_jobs TO authenticated;
GRANT ALL ON public.publish_jobs TO service_role;
ALTER TABLE public.publish_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage publish_jobs" ON public.publish_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.publish_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.publish_jobs(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  platform text NOT NULL,
  username text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  error_message text NOT NULL DEFAULT '',
  remote_post_id text NOT NULL DEFAULT '',
  permalink text NOT NULL DEFAULT '',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publish_targets TO authenticated;
GRANT ALL ON public.publish_targets TO service_role;
ALTER TABLE public.publish_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage publish_targets" ON public.publish_targets FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_publish_targets_job ON public.publish_targets(job_id);
CREATE INDEX idx_social_accounts_platform ON public.social_accounts(platform);
CREATE INDEX idx_publish_jobs_created ON public.publish_jobs(created_at DESC);

CREATE TRIGGER trg_social_accounts_updated BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_publish_jobs_updated BEFORE UPDATE ON public.publish_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_publish_targets_updated BEFORE UPDATE ON public.publish_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.publish_jobs REPLICA IDENTITY FULL;
ALTER TABLE public.publish_targets REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.publish_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.publish_targets;
