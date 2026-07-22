UPDATE public.viral_settings SET min_views = 50000 WHERE min_views = 100000;
ALTER TABLE public.viral_settings ALTER COLUMN min_views SET DEFAULT 50000;
