CREATE TABLE public.affiliate_video_lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.affiliate_video_lessons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_video_lessons TO authenticated;
GRANT ALL ON public.affiliate_video_lessons TO service_role;

ALTER TABLE public.affiliate_video_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read video lessons"
ON public.affiliate_video_lessons FOR SELECT
USING (true);

CREATE POLICY "Admins insert video lessons"
ON public.affiliate_video_lessons FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update video lessons"
ON public.affiliate_video_lessons FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete video lessons"
ON public.affiliate_video_lessons FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_affiliate_video_lessons_updated_at
BEFORE UPDATE ON public.affiliate_video_lessons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();