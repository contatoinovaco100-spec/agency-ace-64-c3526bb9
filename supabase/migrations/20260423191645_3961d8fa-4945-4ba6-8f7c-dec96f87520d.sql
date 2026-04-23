
-- 1. Tighten core business tables: replace public ALL policies with authenticated-only

-- tasks
DROP POLICY IF EXISTS "Allow all access to tasks" ON public.tasks;
CREATE POLICY "Authenticated users manage tasks"
ON public.tasks FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- clients
DROP POLICY IF EXISTS "Allow all access to clients" ON public.clients;
CREATE POLICY "Authenticated users manage clients"
ON public.clients FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- leads
DROP POLICY IF EXISTS "Allow all access to leads" ON public.leads;
CREATE POLICY "Authenticated users manage leads"
ON public.leads FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- calendar_events
DROP POLICY IF EXISTS "Allow all access to calendar_events" ON public.calendar_events;
CREATE POLICY "Authenticated users manage calendar_events"
ON public.calendar_events FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- team_members
DROP POLICY IF EXISTS "Allow all access to team_members" ON public.team_members;
CREATE POLICY "Authenticated users manage team_members"
ON public.team_members FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- task_comments (also fixes EXPOSED_SENSITIVE_DATA finding)
DROP POLICY IF EXISTS "Allow all access to task_comments" ON public.task_comments;
CREATE POLICY "Authenticated users manage task_comments"
ON public.task_comments FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- task_attachments
DROP POLICY IF EXISTS "Allow all access to task_attachments" ON public.task_attachments;
CREATE POLICY "Authenticated users manage task_attachments"
ON public.task_attachments FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- task_checklist_items
DROP POLICY IF EXISTS "Allow all access to task_checklist_items" ON public.task_checklist_items;
CREATE POLICY "Authenticated users manage task_checklist_items"
ON public.task_checklist_items FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- task_stage_history
DROP POLICY IF EXISTS "Allow all access to task_stage_history" ON public.task_stage_history;
CREATE POLICY "Authenticated users manage task_stage_history"
ON public.task_stage_history FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- 2. Restrict client_meta_accounts (contains OAuth access tokens) to admins only
DROP POLICY IF EXISTS "Authenticated users manage meta accounts" ON public.client_meta_accounts;
CREATE POLICY "Admins manage meta accounts"
ON public.client_meta_accounts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Tighten linktree_links UPDATE: anon may only increment clicks; admins manage everything else
DROP POLICY IF EXISTS "Anyone can update click count" ON public.linktree_links;

CREATE POLICY "Anon can increment clicks only"
ON public.linktree_links FOR UPDATE TO anon
USING (true)
WITH CHECK (
  -- Only allow updates that don't change non-click fields
  title = (SELECT title FROM public.linktree_links l WHERE l.id = linktree_links.id)
  AND url = (SELECT url FROM public.linktree_links l WHERE l.id = linktree_links.id)
  AND icon = (SELECT icon FROM public.linktree_links l WHERE l.id = linktree_links.id)
  AND active = (SELECT active FROM public.linktree_links l WHERE l.id = linktree_links.id)
  AND linktree_id = (SELECT linktree_id FROM public.linktree_links l WHERE l.id = linktree_links.id)
  AND sort_order = (SELECT sort_order FROM public.linktree_links l WHERE l.id = linktree_links.id)
);

CREATE POLICY "Admins update linktree links"
ON public.linktree_links FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4. Storage: lock down task-attachments bucket
UPDATE storage.buckets SET public = false WHERE id = 'task-attachments';

-- Drop existing permissive policies on the bucket (best-effort, names may vary)
DROP POLICY IF EXISTS "Imagens Públicas" ON storage.objects;
DROP POLICY IF EXISTS "Upload para Consultores" ON storage.objects;
DROP POLICY IF EXISTS "Allow all uploads to task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public can view task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public can delete task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public can insert task-attachments" ON storage.objects;

CREATE POLICY "Authenticated read task-attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated upload task-attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated update task-attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated delete task-attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'task-attachments');

-- 5. Fix function search_path for update_linktree_updated_at
CREATE OR REPLACE FUNCTION public.update_linktree_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;
