-- Aprovação pelo link público /conteudo: o cliente aprova ou pede ajuste em um conteúdo pronto.
-- Não mexe na coluna do kanban ao aprovar (só marca approved_by_client, que já aparece no card da equipe);
-- ao pedir ajuste, volta o conteúdo para "Revisão". As duas ações viram um comentário na tarefa.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS approved_by_client BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.client_review_task(_id uuid, _approve boolean, _comment text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _status text;
  _note text := left(coalesce(trim(_comment), ''), 2000);
BEGIN
  SELECT status INTO _status FROM public.tasks WHERE id = _id AND deleted_at IS NULL;
  IF _status IS NULL THEN
    RAISE EXCEPTION 'task not found';
  END IF;
  -- Só conteúdos que estão com o cliente para aprovação
  IF NOT (lower(_status) LIKE '%revis%' OR lower(_status) = 'finalizado') THEN
    RAISE EXCEPTION 'task not awaiting approval';
  END IF;

  IF _approve THEN
    UPDATE public.tasks SET approved_by_client = TRUE, approved_at = now() WHERE id = _id;
    INSERT INTO public.task_comments (task_id, author, content)
    VALUES (_id, 'Cliente (link de aprovação)', '✅ Aprovado pelo cliente' || CASE WHEN _note <> '' THEN E'\n' || _note ELSE '' END);
  ELSE
    IF _note = '' THEN
      RAISE EXCEPTION 'comment required';
    END IF;
    UPDATE public.tasks SET approved_by_client = FALSE, approved_at = NULL, status = 'Revisão' WHERE id = _id;
    INSERT INTO public.task_comments (task_id, author, content)
    VALUES (_id, 'Cliente (link de aprovação)', E'✏️ Ajuste pedido pelo cliente:\n' || _note);
  END IF;
END;
$function$;

-- Estado de aprovação para a página pública (só o necessário)
CREATE OR REPLACE FUNCTION public.get_public_task_reviews(_ids uuid[])
RETURNS TABLE (id uuid, approved_by_client boolean, approved_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT t.id, coalesce(t.approved_by_client, FALSE), t.approved_at
  FROM public.tasks t
  WHERE t.id = ANY(_ids) AND t.deleted_at IS NULL;
$function$;

GRANT EXECUTE ON FUNCTION public.client_review_task(uuid, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_task_reviews(uuid[]) TO anon, authenticated;
