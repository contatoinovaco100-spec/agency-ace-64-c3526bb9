
-- ============ QUIZ BUILDER ============

CREATE TABLE public.quiz_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  email text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ativo',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.quiz_clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft', -- draft | active | paused
  result_title text NOT NULL DEFAULT 'Obrigado!',
  result_text text NOT NULL DEFAULT 'Recebemos suas respostas.',
  result_cta_label text NOT NULL DEFAULT '',
  result_cta_url text NOT NULL DEFAULT '',
  views_count integer NOT NULL DEFAULT 0,
  starts_count integer NOT NULL DEFAULT 0,
  completions_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, slug)
);

CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  type text NOT NULL, -- multiple | single | text | lead | visual
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  required boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quiz_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  text text NOT NULL DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quiz_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  lead_name text NOT NULL DEFAULT '',
  lead_email text NOT NULL DEFAULT '',
  lead_phone text NOT NULL DEFAULT '',
  utm_source text NOT NULL DEFAULT '',
  utm_medium text NOT NULL DEFAULT '',
  utm_campaign text NOT NULL DEFAULT ''
);

CREATE TABLE public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.quiz_responses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  option_ids uuid[] NOT NULL DEFAULT '{}',
  text_answer text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quizzes_client_id ON public.quizzes(client_id);
CREATE INDEX idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id, order_index);
CREATE INDEX idx_quiz_options_question_id ON public.quiz_options(question_id, order_index);
CREATE INDEX idx_quiz_responses_quiz_id ON public.quiz_responses(quiz_id, started_at DESC);
CREATE INDEX idx_quiz_answers_response_id ON public.quiz_answers(response_id);

-- RLS
ALTER TABLE public.quiz_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

-- Painel: authenticated gerencia tudo
CREATE POLICY "auth manage quiz_clients" ON public.quiz_clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth manage quizzes" ON public.quizzes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth manage quiz_questions" ON public.quiz_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth manage quiz_options" ON public.quiz_options FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth manage quiz_responses" ON public.quiz_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth manage quiz_answers" ON public.quiz_answers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Público: leitura para a página pública do quiz
CREATE POLICY "public read quiz_clients" ON public.quiz_clients FOR SELECT TO anon USING (status = 'ativo');
CREATE POLICY "public read active quizzes" ON public.quizzes FOR SELECT TO anon USING (status = 'active');
CREATE POLICY "public read quiz_questions" ON public.quiz_questions FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.status = 'active'));
CREATE POLICY "public read quiz_options" ON public.quiz_options FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.quiz_questions qq
    JOIN public.quizzes q ON q.id = qq.quiz_id
    WHERE qq.id = question_id AND q.status = 'active'
  ));

-- Público: enviar respostas
CREATE POLICY "public insert quiz_responses" ON public.quiz_responses FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.status = 'active'));
CREATE POLICY "public update own quiz_responses" ON public.quiz_responses FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public insert quiz_answers" ON public.quiz_answers FOR INSERT TO anon WITH CHECK (true);

-- RPC para incrementar contadores em segurança
CREATE OR REPLACE FUNCTION public.increment_quiz_counter(_quiz_id uuid, _field text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _field NOT IN ('views_count', 'starts_count', 'completions_count') THEN
    RAISE EXCEPTION 'invalid field';
  END IF;
  EXECUTE format('UPDATE public.quizzes SET %I = %I + 1 WHERE id = $1', _field, _field) USING _quiz_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_quiz_counter(uuid, text) TO anon, authenticated;

-- updated_at triggers
CREATE TRIGGER trg_quiz_clients_updated BEFORE UPDATE ON public.quiz_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_quizzes_updated BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
