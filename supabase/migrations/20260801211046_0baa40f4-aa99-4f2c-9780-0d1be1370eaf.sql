CREATE TABLE public.ig_queue_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ig_queue_accounts TO authenticated;
GRANT ALL ON public.ig_queue_accounts TO service_role;
ALTER TABLE public.ig_queue_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage ig_queue_accounts" ON public.ig_queue_accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.ig_queue_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.ig_queue_accounts(id) ON DELETE CASCADE,
  caption text NOT NULL DEFAULT '',
  media_urls text[] NOT NULL DEFAULT '{}',
  media_paths text[] NOT NULL DEFAULT '{}',
  media_type text NOT NULL DEFAULT 'IMAGE',
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'pendente',
  published_at timestamptz,
  published_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ig_queue_posts TO authenticated;
GRANT ALL ON public.ig_queue_posts TO service_role;
ALTER TABLE public.ig_queue_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage ig_queue_posts" ON public.ig_queue_posts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX ig_queue_posts_status_idx ON public.ig_queue_posts (status, scheduled_at);

CREATE POLICY "auth manage instagram media"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'instagram-media')
  WITH CHECK (bucket_id = 'instagram-media');