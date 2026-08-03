-- Adicionar campo para rastrear aprovação do cliente via link público
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS approved_by_client BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT NULL;

-- Atualizar a RPC update_public_task_status para registrar quando aprovado pelo cliente
CREATE OR REPLACE FUNCTION public.update_public_task_status(_id uuid, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF _status NOT IN ('Postado','Programado') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  
  -- Se estiver aprovando (status Postado), registrar que foi pelo cliente
  UPDATE public.tasks 
  SET 
    status = _status,
    approved_by_client = CASE WHEN _status = 'Postado' THEN TRUE ELSE approved_by_client END,
    approved_at = CASE WHEN _status = 'Postado' THEN NOW() ELSE approved_at END
  WHERE id = _id;
END;
$function$;

-- Criar índice para facilitar buscas por conteúdos aprovados
CREATE INDEX IF NOT EXISTS idx_tasks_approved_by_client 
ON public.tasks(approved_by_client) 
WHERE approved_by_client = TRUE;