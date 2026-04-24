
-- LIKES
CREATE TABLE public.rede_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.rede_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX idx_rede_post_likes_post ON public.rede_post_likes(post_id);
CREATE INDEX idx_rede_post_likes_user ON public.rede_post_likes(user_id);

ALTER TABLE public.rede_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone read likes"
  ON public.rede_post_likes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Auth users like"
  ON public.rede_post_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users unlike own"
  ON public.rede_post_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- COMMENTS
CREATE TABLE public.rede_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.rede_posts(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT '',
  author_avatar text NOT NULL DEFAULT '',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rede_post_comments_post ON public.rede_post_comments(post_id, created_at);

ALTER TABLE public.rede_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone read comments"
  ON public.rede_post_comments FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Auth users comment"
  ON public.rede_post_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_user_id AND length(content) > 0 AND length(content) <= 1000);

CREATE POLICY "Users delete own comment or admin"
  ON public.rede_post_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = author_user_id OR public.has_role(auth.uid(), 'admin'::app_role));
