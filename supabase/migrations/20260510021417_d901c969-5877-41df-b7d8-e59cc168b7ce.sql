
-- Bucket público para mídia dos quizzes
INSERT INTO storage.buckets (id, name, public)
VALUES ('quiz-media', 'quiz-media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies para o bucket quiz-media
CREATE POLICY "Public read quiz-media"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'quiz-media');

CREATE POLICY "Authenticated upload quiz-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'quiz-media');

CREATE POLICY "Authenticated update quiz-media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'quiz-media');

CREATE POLICY "Authenticated delete quiz-media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'quiz-media');

-- Colunas em quizzes
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS result_image_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS redirect_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS redirect_delay_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS score_ranges jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pixel_meta text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pixel_ga text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS webhook_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS progress_bar boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_question_numbers boolean NOT NULL DEFAULT true;

-- Colunas em quiz_questions
ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS next_question_id uuid,
  ADD COLUMN IF NOT EXISTS branching jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Colunas em quiz_options
ALTER TABLE public.quiz_options
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '';
