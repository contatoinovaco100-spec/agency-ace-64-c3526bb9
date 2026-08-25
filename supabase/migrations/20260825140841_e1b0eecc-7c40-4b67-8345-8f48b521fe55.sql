INSERT INTO public.kanban_stages (board, name, position, color, is_system)
SELECT v.board, v.name, v.position, v.color, v.is_system
FROM (VALUES
  ('pre','Material Bruto Recebido',0,'muted',false),
  ('pre','Em Decupagem',1,'warning',false),
  ('pre','Cortes Prontos',2,'info',false),
  ('pre','Em Edição',3,'accent',false),
  ('pre','Revisão',4,'destructive',false),
  ('pre','Finalizado',5,'success',true)
) AS v(board,name,position,color,is_system)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_stages k WHERE k.board = 'pre' AND k.name = v.name
);