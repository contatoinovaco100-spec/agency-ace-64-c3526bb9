
ALTER TABLE public.squad_viral_posts
  ADD COLUMN IF NOT EXISTS auto_refresh boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_scraped_at timestamptz,
  ADD COLUMN IF NOT EXISTS scrape_error text,
  ADD COLUMN IF NOT EXISTS previous_views bigint;
