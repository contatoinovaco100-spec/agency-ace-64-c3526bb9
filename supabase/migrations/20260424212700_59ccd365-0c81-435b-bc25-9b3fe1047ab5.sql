-- Permite leitura pública de tarefas (necessário para links /conteudo/:taskId)
CREATE POLICY "Public can view tasks"
ON public.tasks
FOR SELECT
TO anon
USING (true);

-- Também permitir leitura pública de comentários e anexos relacionados
CREATE POLICY "Public can view task_comments"
ON public.task_comments
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Public can view task_attachments"
ON public.task_attachments
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Public can view task_checklist_items"
ON public.task_checklist_items
FOR SELECT
TO anon
USING (true);

-- Permitir que o cliente comente/aprove via página pública
CREATE POLICY "Public can insert task_comments"
ON public.task_comments
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Public can update task status from page"
ON public.tasks
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);