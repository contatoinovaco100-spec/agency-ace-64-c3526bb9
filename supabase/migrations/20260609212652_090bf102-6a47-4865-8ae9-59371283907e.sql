CREATE OR REPLACE FUNCTION public.get_public_arte_tasks()
 RETURNS TABLE(id uuid, title text, description text, assignee text, priority text, due_date date, status text, client_id uuid, client_name text, post_date date, post_time time without time zone, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT t.id, t.title, t.description, t.assignee, t.priority, t.due_date, t.status,
         t.client_id, c.company_name AS client_name, t.post_date, t.post_time, t.created_at
  FROM public.tasks t
  LEFT JOIN public.clients c ON c.id = t.client_id
  WHERE t.task_type = 'Arte'
    AND t.status NOT IN ('Concluído','Postado','Finalizado','Programado')
  ORDER BY 
    CASE t.priority WHEN 'Alta' THEN 1 WHEN 'Média' THEN 2 WHEN 'Baixa' THEN 3 ELSE 4 END,
    t.due_date NULLS LAST,
    t.created_at DESC;
$function$;