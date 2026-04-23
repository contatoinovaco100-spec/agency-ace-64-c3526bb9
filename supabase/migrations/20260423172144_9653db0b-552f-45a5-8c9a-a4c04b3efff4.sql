CREATE TABLE public.instagram_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_url TEXT NOT NULL UNIQUE,
  strategic_description TEXT NOT NULL DEFAULT '',
  post_result TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view instagram posts"
ON public.instagram_posts FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert instagram posts"
ON public.instagram_posts FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update instagram posts"
ON public.instagram_posts FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete instagram posts"
ON public.instagram_posts FOR DELETE
TO authenticated
USING (true);

CREATE TRIGGER update_instagram_posts_updated_at
BEFORE UPDATE ON public.instagram_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_posts;