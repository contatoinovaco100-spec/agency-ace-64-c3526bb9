ALTER TABLE public.publish_jobs
  ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS share_to_feed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS collaborators text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS location_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cover_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS thumb_offset integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audio_name text NOT NULL DEFAULT '';