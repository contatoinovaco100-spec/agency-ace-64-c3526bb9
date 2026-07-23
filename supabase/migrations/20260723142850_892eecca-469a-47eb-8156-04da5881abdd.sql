-- Replace direct public quiz writes/reads with scoped secure functions
DROP POLICY IF EXISTS "public read inserted quiz_responses token" ON public.quiz_responses;
DROP POLICY IF EXISTS "public insert quiz_responses" ON public.quiz_responses;
DROP POLICY IF EXISTS "public insert quiz_answers" ON public.quiz_answers;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.quiz_responses FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.quiz_answers FROM anon;

CREATE OR REPLACE FUNCTION public.start_public_quiz_response(
  _quiz_id uuid,
  _utm_source text DEFAULT '',
  _utm_medium text DEFAULT '',
  _utm_campaign text DEFAULT ''
)
RETURNS TABLE(id uuid, update_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = _quiz_id AND q.status = 'active') THEN
    RAISE EXCEPTION 'quiz is not active';
  END IF;

  RETURN QUERY
  INSERT INTO public.quiz_responses (quiz_id, utm_source, utm_medium, utm_campaign)
  VALUES (_quiz_id, COALESCE(_utm_source, ''), COALESCE(_utm_medium, ''), COALESCE(_utm_campaign, ''))
  RETURNING quiz_responses.id, quiz_responses.update_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_public_quiz_response(uuid, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_public_quiz_answers(
  _response_id uuid,
  _update_token text,
  _answers jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz_id uuid;
  v_count integer := 0;
BEGIN
  SELECT qr.quiz_id INTO v_quiz_id
  FROM public.quiz_responses qr
  WHERE qr.id = _response_id
    AND qr.update_token = _update_token;

  IF v_quiz_id IS NULL THEN
    RAISE EXCEPTION 'invalid quiz response token';
  END IF;

  IF jsonb_typeof(_answers) <> 'array' THEN
    RAISE EXCEPTION 'answers must be an array';
  END IF;

  DELETE FROM public.quiz_answers WHERE response_id = _response_id;

  INSERT INTO public.quiz_answers (response_id, question_id, option_ids, text_answer)
  SELECT
    _response_id,
    (item->>'question_id')::uuid,
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'option_ids', '[]'::jsonb)))::uuid[],
      ARRAY[]::uuid[]
    ),
    COALESCE(item->>'text_answer', '')
  FROM jsonb_array_elements(_answers) AS item
  WHERE EXISTS (
    SELECT 1
    FROM public.quiz_questions qq
    WHERE qq.id = (item->>'question_id')::uuid
      AND qq.quiz_id = v_quiz_id
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_quiz_answers(uuid, text, jsonb) TO anon, authenticated;

-- Ensure the public completion function remains callable without table-level updates.
GRANT EXECUTE ON FUNCTION public.complete_public_quiz_response(uuid, text, text, text, text) TO anon, authenticated;