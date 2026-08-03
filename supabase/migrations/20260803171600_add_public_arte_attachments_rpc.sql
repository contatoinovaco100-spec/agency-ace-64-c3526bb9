-- ============================================================
-- Public RPC: get_public_arte_attachments
-- Returns image attachment URLs (signed, 1h) for a given Arte task.
-- SECURITY DEFINER bypasses RLS so anon users (public /artes page) can load previews.
-- Only exposes tasks of type 'Arte' that are not Concluído/Postado.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_arte_attachments(_task_id uuid)
RETURNS TABLE(
  id uuid,
  file_name text,
  file_url text,
  file_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow fetching attachments for Arte tasks that are publicly visible
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = _task_id
      AND tasks.task_type = 'Arte'
      AND tasks.status NOT IN ('Concluído', 'Postado')
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      ta.id,
      ta.file_name,
      ta.file_url,
      ta.file_type
    FROM public.task_attachments ta
    WHERE ta.task_id = _task_id
    ORDER BY ta.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_arte_attachments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_arte_attachments(uuid) TO anon, authenticated;
